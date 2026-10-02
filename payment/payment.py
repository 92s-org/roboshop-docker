import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone

import pika
import requests
from flask import Flask, Response, jsonify, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from werkzeug.exceptions import HTTPException

from rabbitmq import Publisher

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s - %(message)s')

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

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


def error(message, status):
    return jsonify({'message': message}), status


@app.errorhandler(Exception)
def exception_handler(err):
    # let Flask's own errors (404, 405, 400...) keep their status code
    if isinstance(err, HTTPException):
        return error(err.description, err.code)
    app.logger.exception(err)
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

    # a registered user gets the order in their history, anonymous users do not
    try:
        res = requests.get(f'http://{USER}:{USER_PORT}/check/{id}', timeout=TIMEOUT)
    except requests.RequestException as err:
        app.logger.error(err)
        return error('user service not available', 502)
    anonymous_user = res.status_code != 200

    has_shipping = any(item.get('sku') == 'SHIP' for item in cart['items'])
    if cart.get('total', 0) == 0 or not has_shipping:
        app.logger.warning('cart not valid')
        return error('cart not valid', 400)

    # dummy call to the payment gateway
    if PAYMENT_GATEWAY:
        try:
            res = requests.get(PAYMENT_GATEWAY, timeout=TIMEOUT)
            app.logger.info('%s returned %s', PAYMENT_GATEWAY, res.status_code)
        except requests.RequestException as err:
            app.logger.error(err)
            return error('payment gateway not reachable', 502)
        if res.status_code != 200:
            return error('payment error', 502)

    # Prometheus
    item_count = count_items(cart['items'])
    SOLD_COUNTER.inc(item_count)
    UNITS_SOLD.observe(item_count)
    CART_VALUE.observe(cart.get('total', 0))

    order_id = str(uuid.uuid4())
    placed_at = datetime.now(timezone.utc).isoformat()
    try:
        queue_order({'orderid': order_id, 'user': id, 'cart': cart, 'placedAt': placed_at})
    except pika.exceptions.AMQPError as err:
        app.logger.error('queue error %s', err)
        return error('order queue not available', 503)

    # add to order history
    if not anonymous_user:
        try:
            res = requests.post(f'http://{USER}:{USER_PORT}/order/{id}',
                                json={'orderid': order_id, 'cart': cart, 'placedAt': placed_at},
                                timeout=TIMEOUT)
            app.logger.info('order history returned %s', res.status_code)
        except requests.RequestException as err:
            app.logger.error(err)
            return error('user service not available', 502)

    # empty the cart
    try:
        res = requests.delete(f'http://{CART}:{CART_PORT}/cart/{id}', timeout=TIMEOUT)
        app.logger.info('cart delete returned %s', res.status_code)
    except requests.RequestException as err:
        app.logger.error(err)
        return error('cart service not available', 502)
    if res.status_code != 200:
        return error('cart delete error', 502)

    return jsonify({'orderid': order_id, 'placedAt': placed_at})


def queue_order(order):
    app.logger.info('queue order %s', order['orderid'])
    # for demos, optionally add a bit of delay
    time.sleep(PAYMENT_DELAY_MS / 1000)
    publisher.publish(order)


def count_items(items):
    return sum(item.get('qty', 0) for item in items if item.get('sku') != 'SHIP')


if __name__ == '__main__':
    # local run without gunicorn: python payment.py
    port = int(os.getenv('SHOP_PAYMENT_PORT', '8080'))
    app.logger.info('Payment gateway %s', PAYMENT_GATEWAY)
    app.run(host='0.0.0.0', port=port)
