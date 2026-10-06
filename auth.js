// Single-password authentication: signed, httpOnly session cookie.
const crypto = require('crypto');

const COOKIE_NAME = 'lt_session';
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();

function createAuth({ password, secret }) {
  const attempts = new Map(); // ip -> { count, lockedUntil }

  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const issueToken = () => {
    const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    return `${exp}.${sign(String(exp))}`;
  };

  const verifyToken = (token) => {
    if (!token) return false;
    const [exp, sig] = token.split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const expected = sign(exp);
    return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  };

  const readCookie = (req) => {
    const header = req.headers.cookie || '';
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
    }
    return null;
  };

  const isAuthenticated = (req) => verifyToken(readCookie(req));

  const cookieOptions = (req) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });

  const serializeCookie = (value, opts) =>
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=${opts.path}; Max-Age=${Math.floor(opts.maxAge / 1000)}; HttpOnly; SameSite=Lax${opts.secure ? '; Secure' : ''}`;

  // POST /api/auth/login
  const login = (req, res) => {
    const ip = req.ip;
    const entry = attempts.get(ip) || { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil > Date.now()) {
      const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Çok fazla hatalı deneme. ${minutes} dk sonra tekrar deneyin.` });
    }

    const given = sha256(req.body?.password ?? '');
    if (crypto.timingSafeEqual(given, sha256(password))) {
      attempts.delete(ip);
      res.setHeader('Set-Cookie', serializeCookie(issueToken(), cookieOptions(req)));
      return res.json({ ok: true });
    }

    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.count = 0;
      entry.lockedUntil = Date.now() + LOCK_MS;
    }
    attempts.set(ip, entry);
    return res.status(401).json({ error: 'Şifre hatalı.' });
  };

  // POST /api/auth/logout
  const logout = (req, res) => {
    res.setHeader('Set-Cookie', serializeCookie('', { ...cookieOptions(req), maxAge: 0 }));
    res.json({ ok: true });
  };

  // GET /api/auth/status
  const status = (req, res) => res.json({ authenticated: isAuthenticated(req) });

  // Guards every /api route registered after it (login/logout/status are mounted before)
  const requireAuth = (req, res, next) => {
    if (isAuthenticated(req)) return next();
    return res.status(401).json({ error: 'Giriş gerekli.' });
  };

  return { login, logout, status, requireAuth };
}

module.exports = { createAuth };
