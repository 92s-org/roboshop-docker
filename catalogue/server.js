import express from 'express';
import { MongoClient } from 'mongodb';
import pino from 'pino';
import pinoHttp from 'pino-http';
import promClient from 'prom-client';

const PORT = process.env.CATALOGUE_SERVER_PORT || 8080;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongodb:27017/catalogue';
// optional artificial delay (ms) on product lookups, handy for latency demos
const GO_SLOW = Number(process.env.GO_SLOW || 0);

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

// ---------- MongoDB ----------
let products;
let ratings;
let mongoConnected = false;
const mongoClient = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });

async function mongoConnect() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(); // database name comes from MONGO_URL
        products = db.collection('products');
        ratings = db.collection('ratings');
        await ratings.createIndex({ sku: 1 }, { unique: true });
        mongoConnected = true;
        logger.info('MongoDB connected');
    } catch (err) {
        mongoConnected = false;
        logger.error({ err }, 'MongoDB connection failed, retrying in 2s');
        setTimeout(mongoConnect, 2000);
    }
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

// every data route needs the database
function requireDb(req, res, next) {
    if (!mongoConnected) {
        req.log.error('database not available');
        return res.status(503).json({ message: 'database not available' });
    }
    next();
}

app.get('/health', async (req, res) => {
    let mongo = false;
    try {
        await mongoClient.db().command({ ping: 1 });
        mongo = true;
    } catch {
        mongo = false;
    }
    res.status(mongo ? 200 : 503).json({ app: 'OK', mongo });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

// all products
app.get('/products', requireDb, async (req, res) => {
    const list = await products.find({}).sort({ name: 1 }).toArray();
    res.json(list);
});

// product by SKU
app.get('/product/:sku', requireDb, async (req, res) => {
    if (GO_SLOW > 0) {
        await new Promise((resolve) => setTimeout(resolve, GO_SLOW));
    }
    const product = await products.findOne({ sku: req.params.sku });
    if (!product) {
        return res.status(404).json({ message: 'SKU not found' });
    }
    res.json(product);
});

// products in a category
app.get('/products/:cat', requireDb, async (req, res) => {
    const list = await products.find({ categories: req.params.cat }).sort({ name: 1 }).toArray();
    if (list.length === 0) {
        return res.status(404).json({ message: `No products for ${req.params.cat}` });
    }
    res.json(list);
});

// all categories
app.get('/categories', requireDb, async (req, res) => {
    const categories = await products.distinct('categories');
    res.json(categories.sort());
});

// full text search on name and description
app.get('/search/:text', requireDb, async (req, res) => {
    const hits = await products
        .find({ $text: { $search: req.params.text } }, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } })
        .toArray();
    res.json(hits);
});

// rating for a product
app.get('/ratings/:sku', requireDb, async (req, res) => {
    const doc = await ratings.findOne({ sku: req.params.sku });
    const count = doc?.count ?? 0;
    res.json({
        sku: req.params.sku,
        avg_rating: count ? doc.sum / count : 0,
        rating_count: count
    });
});

// rate a product 1-5
app.put('/rate/:sku/:score', requireDb, async (req, res) => {
    const score = Number.parseInt(req.params.score, 10);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
        return res.status(400).json({ message: 'score must be between 1 and 5' });
    }
    const product = await products.findOne({ sku: req.params.sku });
    if (!product) {
        return res.status(404).json({ message: 'SKU not found' });
    }
    const doc = await ratings.findOneAndUpdate(
        { sku: req.params.sku },
        { $inc: { sum: score, count: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    res.json({ sku: req.params.sku, avg_rating: doc.sum / doc.count, rating_count: doc.count });
});

app.use((req, res) => {
    res.status(404).json({ message: `route ${req.method} ${req.path} not found` });
});

// Express 5 forwards errors thrown in async handlers here
app.use((err, req, res, next) => {
    req.log.error({ err }, 'unhandled error');
    res.status(500).json({ message: 'internal server error' });
});

mongoConnect();

const server = app.listen(PORT, () => logger.info(`catalogue started on port ${PORT}`));

// stop cleanly when Docker sends SIGTERM
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        logger.info(`${signal} received, shutting down`);
        server.close(() => mongoClient.close().finally(() => process.exit(0)));
    });
}
