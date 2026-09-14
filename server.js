const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI environment variable required');
  process.exit(1);
}

const client = new MongoClient(MONGO_URI);
let db;

async function initDb() {
  await client.connect();
  db = client.db('deepvalue');
  console.log('MongoDB connected');

  const entities = db.collection('entities');
  const count = await entities.countDocuments();
  if (count === 0) {
    await entities.insertMany([
      { key: 'dv_eood', title: 'Deep Value EOOD', meta: 'Bulgaria', rows: [{ bank: 'Paysera', accName: 'Deep Value EOOD', number: 'LT00 0000 0000 0000', swift: 'EVIULT21XXX', ccy: 'EUR', rail: 'SEPA', status: 'Active' }] },
      { key: 'dv_ad', title: 'Deep Value AD', meta: 'Bulgaria', rows: [{ bank: 'UniCredit Bulbank', accName: 'Deep Value AD', number: 'BG00 UNCR 0000', swift: 'UNCRBGSF', ccy: 'EUR', rail: 'SWIFT', status: 'Active' }] },
      { key: 'vs_markets', title: 'VS Markets', meta: 'MiCA Cyprus', rows: [{ bank: 'Bank of Cyprus', accName: 'VS Markets Ltd', number: 'CY00 0020 0000', swift: 'BCYPCY2N', ccy: 'EUR', rail: 'SEPA / SWIFT', status: 'Active' }] },
      { key: 'vs_capital', title: 'VS Capital', meta: 'VASP Seychelles', rows: [{ bank: 'ABC Banking', accName: 'VS Capital Ltd', number: 'MU00 ABCB 0000', swift: 'ABCKMUMU', ccy: 'USD', rail: 'SWIFT', status: 'Active' }] }
    ]);
    await db.collection('lp').insertOne({ _id: 'lp', rows: [{ name: 'Sample LP', type: 'Liquidity', juris: 'UK', contact: 'name@lp.com', rails: 'BTC/EUR, USDT', stage: 'KYB sent', owner: '—' }] });
    await db.collection('clients').insertOne({ _id: 'clients', rows: [{ name: 'Sample Client', entity: 'Deep Value EOOD', type: 'Corporate', juris: 'Germany', vol: '€500k', stage: 'New' }] });
  }
}

app.use(express.static(__dirname));
app.set('trust proxy', 1);

app.use(cors({
  origin: 'https://deep-value-otc.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'deep-value-otc-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const users = [{ username: 'deepvalue', password: '$2a$10$ZTizfAIuzTfYaNmy3nYFZu9LPwCOV1P0cw4GYM8I6mt3q6bfFK4.u' }];

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.userId = username;
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ loggedIn: !!req.session.userId });
});

app.get('/api/entities', auth, async (req, res) => {
  const docs = await db.collection('entities').find().toArray();
  const result = {};
  docs.forEach(d => result[d.key] = { title: d.title, meta: d.meta, rows: d.rows });
  res.json(result);
});

app.put('/api/entities/:key', auth, async (req, res) => {
  await db.collection('entities').updateOne({ key: req.params.key }, { $set: { rows: req.body } });
  res.json({ success: true });
});

app.get('/api/lp', auth, async (req, res) => {
  const doc = await db.collection('lp').findOne({ _id: 'lp' });
  res.json(doc?.rows || []);
});

app.put('/api/lp', auth, async (req, res) => {
  await db.collection('lp').updateOne({ _id: 'lp' }, { $set: { rows: req.body } }, { upsert: true });
  res.json({ success: true });
});

app.get('/api/clients', auth, async (req, res) => {
  const doc = await db.collection('clients').findOne({ _id: 'clients' });
  res.json(doc?.rows || []);
});

app.put('/api/clients', auth, async (req, res) => {
  await db.collection('clients').updateOne({ _id: 'clients' }, { $set: { rows: req.body } }, { upsert: true });
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

initDb().then(() => {
  app.listen(PORT, () => console.log('Server running on port', PORT));
});
