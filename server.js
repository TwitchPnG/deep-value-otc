const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public folder
app.use(express.static('public'));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: 'deep-value-otc-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' }
}));

const users = [];

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username exists' });
  }
  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });
  res.json({ success: true, message: 'Account created' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.userId = username;
  res.json({ success: true });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Deep Value - Dashboard</title>
    <style>
      body { background: #0a0a0a; color: #fff; font-family: system-ui; text-align: center; padding: 60px; }
      h1 { color: #f7931a; }
      .btn { background: #f7931a; color: #000; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 20px; }
    </style></head>
    <body>
      <h1>OTC Desk Portal</h1>
      <p>Welcome, ${req.session.userId}</p>
      <button class="btn" onclick="fetch('/logout').then(()=>location.href='/')">Logout</button>
    </body>
    </html>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => console.log('Server running on port', PORT));