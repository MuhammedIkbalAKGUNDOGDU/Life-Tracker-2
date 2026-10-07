// Single-account authentication.
//  - The account (username + password) is created in the app on first visit and stored in the
//    database; the password is never stored, only a salted scrypt hash.
//  - Only ONE account can exist. After it is created, the setup screen is closed for good.
//  - First-time setup needs a setup code (SETUP_CODE in .env, or a random one printed in the
//    server log), so nobody who finds the domain first can claim the account.
//  - Sessions are signed, httpOnly cookies; changing the password logs out every other device.
const crypto = require('crypto');

const COOKIE_NAME = 'lt_session';
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MIN_PASSWORD = 8;

const scryptAsync = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)));
  });

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(String(password), salt);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = String(stored || '').split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(String(password), Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const sameText = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

async function createAuth({ pool, disabled = false }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (key VARCHAR(100) PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Cookie signing key: from .env if given, otherwise generated once and kept in the database
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    const row = (await pool.query("SELECT value FROM app_state WHERE key = 'session_secret'")).rows[0];
    if (row) secret = row.value;
    else {
      secret = crypto.randomBytes(32).toString('hex');
      await pool.query("INSERT INTO app_state (key, value) VALUES ('session_secret', $1)", [secret]);
    }
  }

  // Setup code: from .env, or random (printed to the log) when the account does not exist yet
  let user = (await pool.query('SELECT id, username, session_version FROM app_users ORDER BY id LIMIT 1')).rows[0] || null;
  let setupCode = process.env.SETUP_CODE || null;
  if (!user && !disabled && !setupCode) {
    setupCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    console.log(`🔑 İlk kurulum kodu: ${setupCode}  (hesabı oluştururken sorulacak; SETUP_CODE ile kendiniz de belirleyebilirsiniz)`);
  }

  const attempts = new Map(); // ip -> { count, lockedUntil }

  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const issueToken = () => {
    const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    const body = `${exp}.${user.session_version}`;
    return `${body}.${sign(body)}`;
  };
  const verifyToken = (token) => {
    if (!token || !user) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [exp, ver, sig] = parts;
    if (Number(exp) < Date.now() || Number(ver) !== user.session_version) return false;
    const expected = sign(`${exp}.${ver}`);
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  };

  const readCookie = (req) => {
    for (const part of (req.headers.cookie || '').split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
    }
    return null;
  };
  const isAuthenticated = (req) => verifyToken(readCookie(req));

  const cookie = (req, value, maxAgeMs) =>
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`;
  const setSession = (req, res) => res.setHeader('Set-Cookie', cookie(req, issueToken(), SESSION_DAYS * 24 * 60 * 60 * 1000));

  // Shared brute-force guard (login, setup, change-password)
  const locked = (req, res) => {
    const entry = attempts.get(req.ip);
    if (entry && entry.lockedUntil > Date.now()) {
      const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      res.status(429).json({ error: `Çok fazla hatalı deneme. ${minutes} dk sonra tekrar deneyin.` });
      return true;
    }
    return false;
  };
  const fail = (req) => {
    const entry = attempts.get(req.ip) || { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) { entry.count = 0; entry.lockedUntil = Date.now() + LOCK_MS; }
    attempts.set(req.ip, entry);
  };

  const validate = (username, password) => {
    const u = String(username || '').trim();
    if (u.length < 3 || u.length > 40) return 'Kullanıcı adı 3-40 karakter olmalı.';
    if (String(password || '').length < MIN_PASSWORD) return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
    return null;
  };

  return {
    // GET /api/auth/status
    status: (req, res) => {
      if (disabled) return res.json({ authenticated: true, authDisabled: true });
      res.json({
        authenticated: isAuthenticated(req),
        setupRequired: !user,
        username: isAuthenticated(req) ? user.username : null
      });
    },

    // POST /api/auth/setup: creates the one and only account
    setup: async (req, res) => {
      if (user) return res.status(403).json({ error: 'Hesap zaten oluşturulmuş. Giriş yapın.' });
      if (locked(req, res)) return;
      const { username, password, code } = req.body || {};
      if (!sameText(code || '', setupCode)) {
        fail(req);
        return res.status(401).json({ error: 'Kurulum kodu hatalı.' });
      }
      const problem = validate(username, password);
      if (problem) return res.status(400).json({ error: problem });
      const hash = await hashPassword(password);
      try {
        const { rows } = await pool.query(
          'INSERT INTO app_users (username, password_hash) VALUES ($1, $2) RETURNING id, username, session_version',
          [String(username).trim(), hash]
        );
        user = rows[0];
      } catch (err) {
        console.error(err.message);
        return res.status(409).json({ error: 'Hesap oluşturulamadı.' });
      }
      attempts.delete(req.ip);
      setSession(req, res);
      res.status(201).json({ ok: true, username: user.username });
    },

    // POST /api/auth/login
    login: async (req, res) => {
      if (!user) return res.status(409).json({ error: 'Önce hesap oluşturmanız gerekiyor.' });
      if (locked(req, res)) return;
      const { username, password } = req.body || {};
      const row = (await pool.query('SELECT password_hash FROM app_users WHERE id = $1', [user.id])).rows[0];
      // always hash-compare, so a wrong username takes as long as a wrong password
      const passwordOk = await verifyPassword(password || '', row.password_hash);
      const nameOk = String(username || '').trim().toLowerCase() === user.username.toLowerCase();
      if (passwordOk && nameOk) {
        attempts.delete(req.ip);
        setSession(req, res);
        return res.json({ ok: true, username: user.username });
      }
      fail(req);
      res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    },

    logout: (req, res) => {
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      res.json({ ok: true });
    },

    // POST /api/auth/change-password (needs a valid session). Logs out all other devices.
    changePassword: async (req, res) => {
      if (locked(req, res)) return;
      const { current, next } = req.body || {};
      const row = (await pool.query('SELECT password_hash FROM app_users WHERE id = $1', [user.id])).rows[0];
      if (!(await verifyPassword(current || '', row.password_hash))) {
        fail(req);
        return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
      }
      if (String(next || '').length < MIN_PASSWORD) return res.status(400).json({ error: `Yeni şifre en az ${MIN_PASSWORD} karakter olmalı.` });
      const hash = await hashPassword(next);
      const { rows } = await pool.query(
        'UPDATE app_users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING session_version',
        [hash, user.id]
      );
      user.session_version = rows[0].session_version;
      attempts.delete(req.ip);
      setSession(req, res); // this device stays logged in
      res.json({ ok: true });
    },

    // Guards every /api route mounted after it
    requireAuth: (req, res, next) => {
      if (disabled || isAuthenticated(req)) return next();
      return res.status(401).json({ error: 'Giriş gerekli.' });
    }
  };
}

module.exports = { createAuth };
