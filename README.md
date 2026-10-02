# RoboShop v2 - Docker

A microservices e-commerce shop that sells robots. Every click in the UI travels through several services, databases and a message queue, which makes it a good app for learning Docker, Docker Compose and observability.

---

## Run it

```bash
docker compose up -d --build
docker compose ps          # wait until every service shows (healthy)
```

| What | URL |
|---|---|
| Shop | http://localhost |
| Service status page | http://localhost/status |
| RabbitMQ management UI | http://localhost:15672 (roboshop / roboshop123) |
| Demo shop login | roboshop / RoboShop@1 |

The first start takes a few minutes: MySQL imports about 60 MB of city data, and the Java build downloads Maven dependencies.

Stop and clean up:

```bash
docker compose down        # stop, keep data
docker compose down -v     # stop and delete all data (databases are re-seeded next start)
```

---

## Architecture

```
  Browser ──:80──▶ frontend (React + Nginx)
                       │  /api/<service>/...  (reverse proxy)
     ┌───────────┬─────┴─────┬────────────┬─────────────┐
     ▼           ▼           ▼            ▼             ▼
 catalogue     user        cart        shipping      payment
     │        │    │       │   │        │   │       │   │   │
     ▼        ▼    ▼       ▼   ▼        ▼   ▼       ▼   ▼   ▼
  MongoDB MongoDB Redis  Redis catalogue MySQL cart RabbitMQ user cart
```

| Service | Language / image | Data store | Job |
|---|---|---|---|
| frontend | React 19, Vite, `nginx-unprivileged:1.30-alpine` | - | UI, reverse proxy to all APIs |
| catalogue | Node.js 24, Express 5 | MongoDB 8.0 | products, categories, search, ratings |
| user | Node.js 24, Express 5 | MongoDB 8.0, Redis | register, login, order history, anonymous ids |
| cart | Node.js 24, Express 5 | Redis | cart per user, tax, shipping line |
| shipping | Java 25, Spring Boot 4.1 | MySQL 8.4 | countries, city search, distance and cost |
| payment | Python 3.14, Flask 3, gunicorn | RabbitMQ 4.2 | takes payment, queues the order |

---

## Versions

| Component | Old | New |
|---|---|---|
| Node.js | 20 | 24 (LTS) |
| Python | 3.9 | 3.14 |
| Java | 17 (code built for Java 8) | 25 (LTS) |
| Spring Boot | 2.3 | 4.1 |
| Frontend | AngularJS 1.6 (end of life) | React 19 + Vite |
| MongoDB | 7.0 | 8.0 |
| MySQL | 8.0 | 8.4 (LTS) |
| Redis | 7 | 8.6 |
| RabbitMQ | 3 | 4.2 with management UI |
| Nginx | 1.24 | 1.30 (non-root image) |

---

## What changed compared to the old RoboShop

**Docker and Compose**
- Every service has a **healthcheck**, and `depends_on: condition: service_healthy` starts things in the right order. No more "cart crashed because Redis was not ready yet".
- MySQL is only "healthy" after the city import has finished. The check logs in as the app user and reads the data.
- `restart: unless-stopped` and log rotation (`max-size: 10m`) on every service.
- All app containers run as a **non-root** user.
- Node images use `npm ci` with a lock file, so builds are repeatable.
- The Java Dockerfile caches Maven dependencies in their own layer, so rebuilding after a code change is fast.
- The payment image needs no compiler: uwsgi was replaced with gunicorn.
- Nginx resolves service names at request time through Docker DNS (`resolver 127.0.0.11`). A restarted container with a new IP is found again without a 502.
- The `debug` container is behind a profile: `docker compose --profile debug run --rm debug bash`.

**Application**
- Health endpoints really check their dependencies and return **503** when one is down. The new `/status` page shows all of them live.
- Better status codes: 401 for a wrong login, 409 for a duplicate user or out-of-stock item, 502 when a downstream service is unreachable, 503 when a database is down.
- Passwords are stored as **bcrypt hashes** and never returned by the API (the old one stored and returned plain text).
- When you log in, the anonymous cart is **merged** into your cart instead of overwriting it.
- You cannot add more items to the cart than are in stock.
- Product **ratings** now work. The old UI called a ratings service that did not exist.
- The shipping distance formula is fixed. The old code had two bugs: a constructor typo that always used latitude 0, and a wrong term in the Haversine formula.
- Payment declares a durable `orders` queue, so placed orders can be seen in the RabbitMQ UI. Before, messages were dropped because no queue was bound.
- Instana agents (paid tool, not used in class) were removed. Every service exposes Prometheus metrics instead.
- The cart and session survive a page refresh (stored in the browser).

**UI**
- New React UI: product grid with category filter and sort, live search suggestions, product page with ratings, cart, 4-step checkout with city auto-complete, order history, and a status page.

---

## API reference

All calls go through the frontend: `http://localhost/api/<service>/<path>`.

### catalogue
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | 200 / 503 with Mongo status |
| GET | `/products` | all products |
| GET | `/product/:sku` | 404 if unknown |
| GET | `/products/:category` | 404 if empty |
| GET | `/categories` | |
| GET | `/search/:text` | full-text search |
| GET | `/ratings/:sku` | `{avg_rating, rating_count}` |
| PUT | `/rate/:sku/:score` | score 1-5 |
| GET | `/metrics` | Prometheus |

### user
| Method | Path | Notes |
|---|---|---|
| GET | `/uniqueid` | `{uuid: "anonymous-N"}` from Redis INCR |
| POST | `/register` | `{name, email, password}` → 201, 400, 409 |
| POST | `/login` | `{name, password}` → 200, 401 |
| GET | `/check/:name` | 200 / 404 (used by payment) |
| GET | `/users` | debug list, no passwords |
| POST | `/order/:name` | adds to history (used by payment) |
| GET | `/history/:name` | 404 if no orders |

### cart
| Method | Path | Notes |
|---|---|---|
| GET | `/cart/:id` | 404 if no cart |
| DELETE | `/cart/:id` | used by payment |
| POST (or GET) | `/add/:id/:sku/:qty` | 404 unknown product, 409 out of stock |
| POST (or GET) | `/update/:id/:sku/:qty` | qty 0 removes the item |
| GET | `/rename/:from/:to` | merges carts at login |
| POST | `/shipping/:id` | adds the shipping line (used by shipping) |

The GET forms of add/update are kept so old scripts and docs still work.

### shipping
| Method | Path | Notes |
|---|---|---|
| GET | `/codes` | countries |
| GET | `/match/:code/:text` | city auto-complete, text ≥ 3 chars else 400 |
| GET | `/calc/:cityId` | `{distance, cost}` |
| POST | `/confirm/:id` | `{distance, cost, location}` → updated cart |
| GET | `/count` | number of cities |
| GET | `/memory` / `/free` | memory-leak demo (+25 MB per call) |
| GET | `/actuator/health`, `/actuator/prometheus` | Spring Boot actuator |

### payment
| Method | Path | Notes |
|---|---|---|
| POST | `/pay/:id` | body = cart → `{orderid}`; 400 invalid cart, 502/503 if a dependency is down |
| GET | `/health` | 200 / 503 with RabbitMQ status |
| GET | `/metrics` | Prometheus |

---

## Labs to try

| Try this | What you will see |
|---|---|
| `docker compose stop redis` | status page: user and cart go red (503); adding to cart fails |
| `docker compose stop catalogue` | nginx returns 502 for `/api/catalogue/...`; cart returns 502 "catalogue not available" |
| `docker compose restart cart` | requests work again right away (nginx re-resolves the new IP) |
| `curl localhost/api/shipping/memory` a few times | watch `docker stats shipping` grow; `/free` releases it |
| Place an order, open RabbitMQ UI → Queues → `orders` | the order message waiting in the queue |
| `docker compose logs -f cart` | JSON logs (pino) for every request |
| `curl localhost/api/cart/metrics` | Prometheus metrics, e.g. `items_added` |
| Set `PAYMENT_GATEWAY: ""` in compose | payment works with no internet access |

---

## Local frontend development

```bash
docker compose up -d          # backend stack
cd frontend
npm install
npm run dev                   # http://localhost:5173, /api is proxied to localhost:80
```
