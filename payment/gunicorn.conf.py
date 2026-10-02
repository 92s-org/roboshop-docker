# gunicorn replaces uwsgi: pure Python, no compiler needed in the image
import os

bind = f"0.0.0.0:{os.getenv('SHOP_PAYMENT_PORT', '8080')}"
# one process keeps the Prometheus counters in one place,
# threads handle concurrent requests
workers = 1
threads = 4
timeout = 60
graceful_timeout = 20
accesslog = '-'
errorlog = '-'
loglevel = 'info'
