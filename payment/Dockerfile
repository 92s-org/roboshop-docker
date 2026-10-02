FROM python:3.14.8-alpine3.24 AS builder
WORKDIR /app
COPY requirements.txt .
# all dependencies are pure Python wheels, no gcc needed
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.14.8-alpine3.24
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
RUN addgroup -S roboshop && adduser -S -G roboshop roboshop
COPY --from=builder /install /usr/local
COPY --chown=roboshop:roboshop payment.py rabbitmq.py gunicorn.conf.py ./
USER roboshop
EXPOSE 8080
CMD ["gunicorn", "--config", "gunicorn.conf.py", "payment:app"]
