import express from 'express';
import { createClient } from 'redis';
import pino from 'pino';
import pinoHttp from 'pino-http';
import promClient from 'prom-client';

const PORT = process.env.CART_SERVER_PORT || 8080;
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_URL = process.env.REDIS_URL || `redis://${REDIS_HOST}:6379`;
const CATALOGUE_HOST = process.env.CATALOGUE_HOST || 'catalogue';
const CATALOGUE_PORT = process.env.CATALOGUE_PORT || '8080';
// carts expire after one hour of no activity
const CART_TTL_SECONDS = Number(process.env.CART_TTL_SECONDS || 3600);
const TAX_RATE = 0.2;

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ---------- Prometheus ----------
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
const httpDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});
const itemsAdded = new promClient.Counter({
    name: 'items_added',
    help: 'running count of items added to cart',
    registers: [register]
});

// ---------- Redis ----------
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
redisClient.on('ready', () => logger.info('Redis connected'));

// ---------- helpers ----------
const round2 = (n) => Math.round(n * 100) / 100;

function emptyCart() {
    return { total: 0, tax: 0, items: [] };
}

// prices include 20% tax, so the tax part is total - total / 1.2
function recalc(cart) {
    cart.total = round2(cart.items.reduce((sum, item) => sum + item.subtotal, 0));
    cart.tax = round2(cart.total - cart.total / (1 + TAX_RATE));
    return cart;
}

async function loadCart(id) {
    const data = await redisClient.get(id);
    return data ? JSON.parse(data) : null;
}

async function saveCart(id, cart) {
    await redisClient.set(id, JSON.stringify(cart), { EX: CART_TTL_SECONDS });
}

// returns the product, null if the SKU does not exist, throws if catalogue is down
async function getProduct(sku) {
    const url = `http://${CATALOGUE_HOST}:${CATALOGUE_PORT}/product/${encodeURIComponent(sku)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`catalogue returned ${res.status}`);
    }
    return res.json();
}

function parseQty(value) {
    const qty = Number.parseInt(value, 10);
    return Number.isNaN(qty) ? null : qty;
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => ['/health', '/metrics'].includes(req.url) } }));
app.use(express.json());

app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => end({ method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode }));
    next();
});

function requireRedis(req, res, next) {
    if (!redisClient.isReady) {
        req.log.error('redis not available');
        return res.status(503).json({ message: 'redis not available' });
    }
    next();
}

app.get('/health', (req, res) => {
    const redis = redisClient.isReady;
    res.status(redis ? 200 : 503).json({ app: 'OK', redis });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

// get cart
app.get('/cart/:id', requireRedis, async (req, res) => {
    const cart = await loadCart(req.params.id);
    if (!cart) {
        return res.status(404).json({ message: 'cart not found' });
    }
    res.json(cart);
});

// delete cart (called by payment after an order)
app.delete('/cart/:id', requireRedis, async (req, res) => {
    const deleted = await redisClient.del(req.params.id);
    if (deleted !== 1) {
        return res.status(404).json({ message: 'cart not found' });
    }
    res.json({ message: 'OK' });
});

// move the anonymous cart to the user at login, merging with any cart the user already has
app.get('/rename/:from/:to', requireRedis, async (req, res) => {
    const from = await loadCart(req.params.from);
    if (!from) {
        return res.status(404).json({ message: 'cart not found' });
    }
    const to = (await loadCart(req.params.to)) ?? emptyCart();
    for (const item of from.items) {
        const existing = to.items.find((i) => i.sku === item.sku);
        if (existing && item.sku !== 'SHIP') {
            existing.qty += item.qty;
            existing.subtotal = round2(existing.price * existing.qty);
        } else if (!existing) {
            to.items.push(item);
        }
    }
    recalc(to);
    await saveCart(req.params.to, to);
    await redisClient.del(req.params.from);
    res.json(to);
});

// add qty of sku to the cart, creating the cart if needed
// GET kept for compatibility with the old API, the new frontend uses POST
async function addToCart(req, res) {
    const qty = parseQty(req.params.qty);
    if (qty === null) {
        return res.status(400).json({ message: 'quantity must be a number' });
    }
    if (qty < 1) {
        return res.status(400).json({ message: 'quantity has to be greater than zero' });
    }

    let product;
    try {
        product = await getProduct(req.params.sku);
    } catch (err) {
        req.log.error({ err }, 'catalogue lookup failed');
        return res.status(502).json({ message: 'catalogue not available' });
    }
    if (!product) {
        return res.status(404).json({ message: 'product not found' });
    }
    if (product.instock === 0) {
        return res.status(409).json({ message: 'out of stock' });
    }

    const cart = (await loadCart(req.params.id)) ?? emptyCart();
    const existing = cart.items.find((i) => i.sku === req.params.sku);
    const newQty = (existing?.qty ?? 0) + qty;
    if (newQty > product.instock) {
        return res.status(409).json({ message: `only ${product.instock} in stock` });
    }

    if (existing) {
        existing.qty = newQty;
        existing.subtotal = round2(existing.price * newQty);
    } else {
        cart.items.push({
            qty,
            sku: product.sku,
            name: product.name,
            price: product.price,
            subtotal: round2(qty * product.price)
        });
    }
    recalc(cart);
    await saveCart(req.params.id, cart);
    itemsAdded.inc(qty);
    res.json(cart);
}
app.route('/add/:id/:sku/:qty').get(requireRedis, addToCart).post(requireRedis, addToCart);

// set quantity of an item, qty 0 removes it
async function updateCart(req, res) {
    const qty = parseQty(req.params.qty);
    if (qty === null) {
        return res.status(400).json({ message: 'quantity must be a number' });
    }
    if (qty < 0) {
        return res.status(400).json({ message: 'negative quantity not allowed' });
    }
    const cart = await loadCart(req.params.id);
    if (!cart) {
        return res.status(404).json({ message: 'cart not found' });
    }
    const idx = cart.items.findIndex((i) => i.sku === req.params.sku);
    if (idx === -1) {
        return res.status(404).json({ message: 'not in cart' });
    }
    if (qty === 0) {
        cart.items.splice(idx, 1);
    } else {
        cart.items[idx].qty = qty;
        cart.items[idx].subtotal = round2(cart.items[idx].price * qty);
    }
    recalc(cart);
    await saveCart(req.params.id, cart);
    res.json(cart);
}
app.route('/update/:id/:sku/:qty').get(requireRedis, updateCart).post(requireRedis, updateCart);

// add or replace the shipping line (called by shipping service)
app.post('/shipping/:id', requireRedis, async (req, res) => {
    const shipping = req.body ?? {};
    if (shipping.distance === undefined || shipping.cost === undefined || shipping.location === undefined) {
        req.log.warn({ shipping }, 'shipping data missing');
        return res.status(400).json({ message: 'shipping data missing' });
    }
    const cart = await loadCart(req.params.id);
    if (!cart) {
        return res.status(404).json({ message: 'cart not found' });
    }
    const item = {
        qty: 1,
        sku: 'SHIP',
        name: `shipping to ${shipping.location}`,
        price: shipping.cost,
        subtotal: shipping.cost
    };
    const idx = cart.items.findIndex((i) => i.sku === 'SHIP');
    if (idx === -1) {
        cart.items.push(item);
    } else {
        cart.items[idx] = item;
    }
    recalc(cart);
    await saveCart(req.params.id, cart);
    res.json(cart);
});

app.use((req, res) => {
    res.status(404).json({ message: `route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'request body is not valid JSON' });
    }
    req.log.error({ err }, 'unhandled error');
    res.status(500).json({ message: 'internal server error' });
});

redisClient.connect().catch((err) => logger.error({ err }, 'Redis initial connect failed'));

const server = app.listen(PORT, () => logger.info(`cart started on port ${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        logger.info(`${signal} received, shutting down`);
        server.close(() => redisClient.quit().finally(() => process.exit(0)));
    });
}
