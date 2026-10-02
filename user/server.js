import { randomUUID } from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import { createClient } from 'redis';
import pino from 'pino';
import pinoHttp from 'pino-http';
import promClient from 'prom-client';

const PORT = process.env.USER_SERVER_PORT || 8080;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongodb:27017/users';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'user' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    // never write passwords to the logs
    redact: ['password', '*.password']
});

// ---------- Prometheus ----------
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
const httpDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});
const registrations = new promClient.Counter({
    name: 'users_registered_total',
    help: 'Number of users registered',
    registers: [register]
});

// ---------- MongoDB ----------
let usersCollection;
let ordersCollection;
let mongoConnected = false;
const mongoClient = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });

async function mongoConnect() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(); // database name comes from MONGO_URL
        usersCollection = db.collection('users');
        ordersCollection = db.collection('orders');
        await usersCollection.createIndex({ name: 1 }, { unique: true });
        await ordersCollection.createIndex({ name: 1 }, { unique: true });
        mongoConnected = true;
        logger.info('MongoDB connected');
    } catch (err) {
        mongoConnected = false;
        logger.error({ err }, 'MongoDB connection failed, retrying in 2s');
        setTimeout(mongoConnect, 2000);
    }
}

// ---------- Redis ----------
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
redisClient.on('ready', () => logger.info('Redis connected'));

// never send the password hash back to the browser
function publicUser(user) {
    const { password, ...rest } = user;
    return rest;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
// one JSON line per request: method, url, status, duration and a request id.
// the id comes from nginx (X-Request-Id) so one click can be followed across services
app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
        const id = req.headers['x-request-id'] || randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
    },
    // quietReqLogger puts requestId on every log line of the request
    quietReqLogger: true,
    customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
    customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
    serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode })
    },
    autoLogging: { ignore: (req) => ['/health', '/metrics'].includes(req.url) }
}));
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => end({ method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode }));
    next();
});

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
    const redis = redisClient.isReady;
    res.status(mongo && redis ? 200 : 503).json({ app: 'OK', mongo, redis });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

// use Redis INCR to hand out ids to anonymous visitors
app.get('/uniqueid', async (req, res) => {
    if (!redisClient.isReady) {
        return res.status(503).json({ message: 'redis not available' });
    }
    const counter = await redisClient.incr('anonymous-counter');
    res.json({ uuid: `anonymous-${counter}` });
});

// check user exists (used by payment)
app.get('/check/:id', requireDb, async (req, res) => {
    const user = await usersCollection.findOne({ name: req.params.id });
    if (!user) {
        return res.status(404).json({ message: 'user not found' });
    }
    res.json({ message: 'OK' });
});

// all users, for debugging only
app.get('/users', requireDb, async (req, res) => {
    const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
});

app.post('/login', requireDb, async (req, res) => {
    const { name, password } = req.body ?? {};
    if (!name || !password) {
        return res.status(400).json({ message: 'name or password not supplied' });
    }
    const user = await usersCollection.findOne({ name });
    // same message for unknown user and wrong password so names can't be guessed
    if (!user || !(await bcrypt.compare(password, user.password))) {
        req.log.warn({ name }, 'login failed');
        return res.status(401).json({ message: 'invalid name or password' });
    }
    res.json(publicUser(user));
});

app.post('/register', requireDb, async (req, res) => {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim();
    const password = req.body?.password;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ message: 'email address is not valid' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'password must be at least 6 characters' });
    }
    if (await usersCollection.findOne({ name })) {
        return res.status(409).json({ message: 'name already exists' });
    }
    const user = {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        createdAt: new Date().toISOString()
    };
    await usersCollection.insertOne(user);
    registrations.inc();
    res.status(201).json(publicUser(user));
});

// add an order to the user's history (called by payment)
app.post('/order/:id', requireDb, async (req, res) => {
    const user = await usersCollection.findOne({ name: req.params.id });
    if (!user) {
        return res.status(404).json({ message: 'name not found' });
    }
    const order = { ...req.body, placedAt: req.body?.placedAt ?? new Date().toISOString() };
    await ordersCollection.updateOne(
        { name: req.params.id },
        { $push: { history: order } },
        { upsert: true }
    );
    res.status(201).json({ message: 'OK' });
});

app.get('/history/:id', requireDb, async (req, res) => {
    const history = await ordersCollection.findOne({ name: req.params.id });
    if (!history) {
        return res.status(404).json({ message: 'history not found' });
    }
    res.json(history);
});

// path exists but not for this method -> 405 with an Allow header
app.use((req, res, next) => {
    const allowed = new Set();
    for (const layer of app.router.stack) {
        if (layer.route && layer.match(req.path)) {
            Object.keys(layer.route.methods).forEach((m) => allowed.add(m.toUpperCase()));
        }
    }
    if (allowed.size === 0) return next();
    if (allowed.has('GET')) allowed.add('HEAD');
    res.set('Allow', [...allowed].join(', '));
    res.status(405).json({ message: `method ${req.method} not allowed on ${req.path}` });
});

app.use((req, res) => {
    res.status(404).json({ message: `route ${req.method} ${req.path} not found` });
});

// Express 5 forwards errors thrown in async handlers here
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'request body is not valid JSON' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ message: 'request body too large' });
    }
    // two registrations with the same name at the same moment hit the unique index
    if (err.code === 11000) {
        return res.status(409).json({ message: 'name already exists' });
    }
    req.log.error({ err }, 'unhandled error');
    res.status(500).json({ message: 'internal server error' });
});

// node-redis keeps reconnecting on its own after the first attempt
redisClient.connect().catch((err) => logger.error({ err }, 'Redis initial connect failed'));
mongoConnect();

const server = app.listen(PORT, () => logger.info(`user started on port ${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        logger.info(`${signal} received, shutting down`);
        server.close(() => {
            Promise.allSettled([mongoClient.close(), redisClient.quit()]).finally(() => process.exit(0));
        });
    });
}
