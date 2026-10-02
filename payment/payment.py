import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone

import pika
import requests
from flask import Flask, Response, g, has_request_context, jsonify, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from werkzeug.exceptions import HTTPException

from rabbitmq import Publisher


# ---------- logging: one JSON object per line, like the Node services ----------
class JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            'time': datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec='milliseconds'),
            'level': record.levelname.lower(),
            'service': 'payment',
            'msg': record.getMessage(),
        }
        if has_request_context():
            entry['requestId'] = g.get('request_id')
        for key in ('method', 'url', 'statusCode', 'durationMs'):
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        if record.exc_info:
            entry['err'] = self.formatException(record.exc_info)
        return json.dumps(entry)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
# pika is very chatty on connection errors, we log those ourselves
logging.getLogger('pika').setLevel(logging.CRITICAL)

app = Flask(__name__)
app.logger.setLevel(logging.INFO)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024  # bigger bodies get 413

CART = os.getenv('CART_HOST', 'cart')
CART_PORT = os.getenv('CART_PORT', '8080')
USER = os.getenv('USER_HOST', 'user')
USER_PORT = os.getenv('USER_PORT', '8080')
# a dummy call to a "payment gateway", set it empty to skip (for offline labs)
PAYMENT_GATEWAY = os.getenv('PAYMENT_GATEWAY', 'https://www.google.com/')
PAYMENT_DELAY_MS = int(os.getenv('PAYMENT_DELAY_MS', '0'))
TIMEOUT = 5

# Prometheus
SOLD_COUNTER = Counter('sold_count', 'Running count of items sold')
UNITS_SOLD = Histogram('units_sold', 'Average Unit Sale', buckets=(1, 2, 5, 10, 100))
CART_VALUE = Histogram('cart_value', 'Average Value Sale', buckets=(100, 200, 500, 1000, 2000, 5000, 10000))

publisher = Publisher(app.logger)


# ---------- request id + access log ----------
@app.before_request
def start_request():
    g.request_id = request.headers.get('X-Request-Id') or str(uuid.uuid4())
    g.started = time.perf_counter()


@app.after_request
def log_request(response):
    response.headers['X-Request-Id'] = g.get('request_id', '')
    if request.path not in ('/health', '/metrics'):
        status = response.status_code
        level = logging.ERROR if status >= 500 else logging.WARNING if status >= 400 else logging.INFO
        app.logger.log(level, '%s %s %s', request.method, request.full_path.rstrip('?'), status, extra={
            'method': request.method,
            'url': request.full_path.rstrip('?'),
            'statusCode': status,
            'durationMs': round((time.perf_counter() - g.get('started', time.perf_counter())) * 1000),
        })
    return response


def downstream_headers():
    # pass the id on so user and cart log the same request id
    return {'X-Request-Id': g.request_id}


def error(message, status):
    return jsonify({'message': message}), status


def downstream_error(service, err):
    # 504 = the service was too slow, 502 = it was down or broken
    app.logger.error('%s call failed: %s', service, err)
    if isinstance(err, requests.Timeout):
        return error(f'{service} service did not answer in time', 504)
    return error(f'{service} service not available', 502)


@app.errorhandler(Exception)
def exception_handler(err):
    # let Flask's own errors (404, 405, 413...) keep their status code
    # (get_response keeps headers such as Allow on a 405)
    if isinstance(err, HTTPException):
        response = err.get_response()
        response.set_data(json.dumps({'message': err.description}))
        response.content_type = 'application/json'
        return response
    app.logger.exception('unhandled error')
    return error('internal server error', 500)


@app.get('/health')
def health():
    rabbitmq = publisher.healthy()
    return jsonify({'app': 'OK', 'rabbitmq': rabbitmq}), 200 if rabbitmq else 503


@app.get('/metrics')
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)


@app.post('/pay/<id>')
def pay(id):
    app.logger.info('payment for %s', id)
    cart = request.get_json(silent=True)
    if not isinstance(cart, dict) or not isinstance(cart.get('items'), list):
        return error('cart not valid', 400)

    has_shipping = any(item.get('sku') == 'SHIP' for item in cart['items'])
    if cart.get('total', 0) == 0 or not has_shipping:
        app.logger.warning('cart not valid: empty or no shipping')
        return error('cart not valid', 400)

    # 200 = registered user (order goes into history), 404 = anonymous visitor
    try:
        res = requests.get(f'http://{USER}:{USER_PORT}/check/{id}',
                           headers=downstream_headers(), timeout=TIMEOUT)
    except requests.RequestException as err:
        return downstream_error('user', err)
    if res.status_code not in (200, 404):
        app.logger.error('user check returned %s', res.status_code)
        return error('user service error', 502)
    anonymous_user = res.status_code == 404

    # dummy call to the payment gateway
    if PAYMENT_GATEWAY:
        try:
            res = requests.get(PAYMENT_GATEWAY, timeout=TIMEOUT)
            app.logger.info('%s returned %s', PAYMENT_GATEWAY, res.status_code)
        except requests.RequestException as err:
            return downstream_error('payment gateway', err)
        if res.status_code != 200:
            return error('payment declined by gateway', 502)

    order_id = str(uuid.uuid4())
    placed_at = datetime.now(timezone.utc).isoformat()
    try:
        queue_order({'orderid': order_id, 'user': id, 'cart': cart, 'placedAt': placed_at})
    except pika.exceptions.AMQPError as err:
        app.logger.error('queue error: %r', err)
        return error('order queue not available', 503)

    # Prometheus
    item_count = count_items(cart['items'])
    SOLD_COUNTER.inc(item_count)
    UNITS_SOLD.observe(item_count)
    CART_VALUE.observe(cart.get('total', 0))

    # From here the order is paid and queued, so the shopper gets a success
    # even if the follow-up steps fail. Failures are logged for ops to fix.
    if not anonymous_user:
        try:
            res = requests.post(f'http://{USER}:{USER_PORT}/order/{id}',
                                json={'orderid': order_id, 'cart': cart, 'placedAt': placed_at},
                                headers=downstream_headers(), timeout=TIMEOUT)
            if res.status_code >= 300:
                app.logger.error('order history update returned %s for order %s', res.status_code, order_id)
        except requests.RequestException as err:
            app.logger.error('order history update failed for order %s: %s', order_id, err)

    try:
        res = requests.delete(f'http://{CART}:{CART_PORT}/cart/{id}',
                              headers=downstream_headers(), timeout=TIMEOUT)
        if res.status_code >= 300:
            app.logger.warning('cart delete returned %s for order %s', res.status_code, order_id)
    except requests.RequestException as err:
        app.logger.error('cart delete failed for order %s: %s', order_id, err)

    app.logger.info('order %s placed', order_id)
    return jsonify({'orderid': order_id, 'placedAt': placed_at}), 201


def queue_order(order):
    # for demos, optionally add a bit of delay
    time.sleep(PAYMENT_DELAY_MS / 1000)
    publisher.publish(order, {'X-Request-Id': g.request_id})
    app.logger.info('order %s queued', order['orderid'])


def count_items(items):
    return sum(item.get('qty', 0) for item in items if item.get('sku') != 'SHIP')


if __name__ == '__main__':
    # local run without gunicorn: python payment.py
    port = int(os.getenv('SHOP_PAYMENT_PORT', '8080'))
    app.logger.info('payment gateway %s', PAYMENT_GATEWAY)
    app.run(host='0.0.0.0', port=port)
