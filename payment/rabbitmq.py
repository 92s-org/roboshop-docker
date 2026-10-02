import json
import os
import threading

import pika


class Publisher:
    HOST = os.getenv('AMQP_HOST', 'rabbitmq')
    PORT = int(os.getenv('AMQP_PORT', '5672'))
    USER = os.getenv('AMQP_USER', 'guest')
    PASS = os.getenv('AMQP_PASS', 'guest')
    VIRTUAL_HOST = '/'
    EXCHANGE = 'robot-shop'
    TYPE = 'direct'
    ROUTING_KEY = 'orders'
    # a durable queue bound to the exchange, so orders are kept
    # and can be seen in the RabbitMQ management UI
    QUEUE = 'orders'

    def __init__(self, logger):
        self._logger = logger
        self._params = pika.ConnectionParameters(
            host=self.HOST,
            port=self.PORT,
            virtual_host=self.VIRTUAL_HOST,
            credentials=pika.PlainCredentials(self.USER, self.PASS),
            connection_attempts=3,
            retry_delay=2,
            blocked_connection_timeout=10)
        self._conn = None
        self._channel = None
        # pika's BlockingConnection is not thread safe, gunicorn runs threads
        self._lock = threading.Lock()

    def _connect(self):
        self._conn = pika.BlockingConnection(self._params)
        self._channel = self._conn.channel()
        self._channel.exchange_declare(exchange=self.EXCHANGE, exchange_type=self.TYPE, durable=True)
        self._channel.queue_declare(queue=self.QUEUE, durable=True)
        self._channel.queue_bind(queue=self.QUEUE, exchange=self.EXCHANGE, routing_key=self.ROUTING_KEY)
        self._logger.info('connected to broker')

    def _is_open(self):
        return (self._conn is not None and self._conn.is_open
                and self._channel is not None and self._channel.is_open)

    def _publish(self, msg, headers):
        self._channel.basic_publish(
            exchange=self.EXCHANGE,
            routing_key=self.ROUTING_KEY,
            properties=pika.BasicProperties(
                headers=headers,
                content_type='application/json',
                delivery_mode=pika.DeliveryMode.Persistent),
            body=json.dumps(msg).encode())
        self._logger.info('message sent')

    # publish msg, reconnecting once if the connection dropped
    def publish(self, msg, headers=None):
        with self._lock:
            if not self._is_open():
                self._connect()
            try:
                self._publish(msg, headers or {})
            except (pika.exceptions.AMQPConnectionError, pika.exceptions.StreamLostError,
                    pika.exceptions.ChannelClosed):
                self._logger.info('reconnecting to queue')
                self._connect()
                self._publish(msg, headers or {})

    def healthy(self):
        with self._lock:
            try:
                if not self._is_open():
                    self._connect()
                # also services heartbeats so an idle connection stays alive
                self._conn.process_data_events(time_limit=0)
                return True
            except (pika.exceptions.AMQPError, OSError):
                self._conn = None
                self._channel = None
                return False
                return False

    def close(self):
        with self._lock:
            if self._conn and self._conn.is_open:
                self._logger.info('closing queue connection')
                self._conn.close()
