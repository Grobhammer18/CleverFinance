import express from 'express';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
dotenv.config({ path: envPath });

const app = express();
const port = Number(process.env.BILLING_PORT || 4242);
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

if (!stripeSecret) {
  console.warn('[billing] Missing STRIPE_SECRET_KEY. Billing endpoints will fail until it is set.');
}

const stripe = new Stripe(stripeSecret);
const authSecret = process.env.AUTH_SECRET || 'dev-auth-secret-change-me';
const googleClient = new OAuth2Client();
const appleAudience = process.env.APPLE_CLIENT_ID || process.env.VITE_APPLE_CLIENT_ID || '';
const appleIssuer = 'https://appleid.apple.com';
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const dataDir = path.resolve('server/data');
const usersFile = path.join(dataDir, 'users.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2));

function loadUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify({ users }, null, 2));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Gmail/Googlemail: Punkte im lokalen Teil + alles ab + im lokalen Teil ignorieren (gleiche Mailbox). */
function gmailCanonicalLocalPart(local) {
  return String(local || '')
    .split('+')[0]
    .replace(/\./g, '');
}

/** Gleiches Konto? (normalisiert + Gmail-Regeln, damit Google ↔ Passwort-Konto zusammenfinden.) */
function emailsMatchForAccountMerge(a, b) {
  const na = normalizeEmail(a);
  const nb = normalizeEmail(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [la, da] = na.split('@');
  const [lb, db] = nb.split('@');
  if (!la || !lb || !da || !db) return false;
  const dLow = da.toLowerCase();
  if (dLow !== db.toLowerCase()) return false;
  if (dLow === 'gmail.com' || dLow === 'googlemail.com') {
    return gmailCanonicalLocalPart(la) === gmailCanonicalLocalPart(lb);
  }
  return false;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', authSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', authSecret).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.userId || !payload?.email) return null;
    return payload;
  } catch {
    return null;
  }
}

function getAuthPayload(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyToken(token);
}

function sanitizeUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

function createDefaultState() {
  return {
    subscription: { tier: 'free', cycle: 'monthly' },
  };
}

function upsertOauthUser({ provider, providerId, email, name }) {
  const users = loadUsers();
  const pid = String(providerId || '');
  const normEmail = normalizeEmail(email);

  let user =
    users.find((u) => String(u.oauth?.[provider] || '') === pid) ||
    users.find((u) => normEmail && emailsMatchForAccountMerge(u.email, normEmail));

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: normEmail || `${provider}-${pid}@no-email.local`,
      name: name || 'User',
      passwordHash: null,
      oauth: { [provider]: pid },
      state: createDefaultState(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(user);
  } else {
    user.oauth = { ...(user.oauth || {}), [provider]: pid };
    if (normEmail) user.email = normEmail;
    if (name) user.name = name;
    user.updatedAt = new Date().toISOString();
  }

  saveUsers(users);
  return user;
}

const PRICE_IDS = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  elite: {
    monthly: process.env.STRIPE_PRICE_ELITE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ELITE_YEARLY,
  },
};

function inferTierFromSession(session) {
  const priceId = session?.line_items?.data?.[0]?.price?.id || session?.metadata?.priceId;
  if (!priceId) return 'free';
  if (priceId === PRICE_IDS.pro.monthly || priceId === PRICE_IDS.pro.yearly) return 'pro';
  if (priceId === PRICE_IDS.elite.monthly || priceId === PRICE_IDS.elite.yearly) return 'elite';
  return 'free';
}

function inferCycleFromSession(session) {
  const priceId = session?.line_items?.data?.[0]?.price?.id || session?.metadata?.priceId;
  if (!priceId) return 'monthly';
  if (priceId === PRICE_IDS.pro.yearly || priceId === PRICE_IDS.elite.yearly) return 'yearly';
  return 'monthly';
}

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003,http://127.0.0.1:5173,http://192.168.178.84:3000,http://192.168.178.84:3001,http://192.168.178.84:3002,http://192.168.178.84:3003'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isCapacitorOrigin(origin) {
  if (!origin) return false;
  return (
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    /^capacitor:\/\/[^/]+$/.test(origin)
  );
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (allowedOrigins.includes(origin) ||
      isCapacitorOrigin(origin) ||
      /^http:\/\/192\.168\.\d+\.\d+:300\d$/.test(origin) ||
      /^http:\/\/localhost:(300\d|5173)$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:(300\d|5173)$/.test(origin))
  ) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
  res.header('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    if (!webhookSecret) return res.status(400).send('Missing STRIPE_WEBHOOK_SECRET');
    const signature = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    if (event.type === 'checkout.session.completed') {
      console.log('[billing] checkout.session.completed');
    }
    if (event.type === 'customer.subscription.updated') {
      console.log('[billing] customer.subscription.updated');
    }
    if (event.type === 'customer.subscription.deleted') {
      console.log('[billing] customer.subscription.deleted');
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[billing] webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.use(express.json());

app.get('/api/billing/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim() || email.split('@')[0] || 'User';
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Bitte gültige E-Mail und Passwort (min. 6 Zeichen) angeben.' });
  }

  const users = loadUsers();
  if (users.some((u) => u.email === email)) {
    return res.status(400).json({ error: 'E-Mail ist bereits registriert.' });
  }

  const user = {
    id: crypto.randomUUID(),
    email,
    name,
    passwordHash: hashPassword(password),
    state: createDefaultState(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);

  const token = signToken({ userId: user.id, email: user.email });
  return res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const users = loadUsers();
  const user = users.find((u) => u.email === email);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort.' });
  }
  const token = signToken({ userId: user.id, email: user.email });
  return res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/me', (req, res) => {
  const payload = getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const users = loadUsers();
  const user = users.find((u) => u.id === payload.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ user: sanitizeUser(user) });
});

app.put('/api/auth/profile', (req, res) => {
  const payload = getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const name = String(req.body?.name || '').trim();
  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'Name muss mindestens 2 Zeichen lang sein.' });
  }

  const users = loadUsers();
  const index = users.findIndex((u) => u.id === payload.userId);
  if (index < 0) return res.status(401).json({ error: 'Unauthorized' });

  users[index] = {
    ...users[index],
    name,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);
  return res.json({ user: sanitizeUser(users[index]) });
});

app.post('/api/auth/oauth/google', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '');
    const audience = process.env.GOOGLE_CLIENT_ID || undefined;
    if (!idToken) return res.status(400).json({ error: 'Missing idToken.' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return res.status(401).json({ error: 'Invalid Google token.' });

    const user = upsertOauthUser({
      provider: 'google',
      providerId: payload.sub,
      email: normalizeEmail(payload.email || ''),
      name: payload.name || 'Google User',
    });

    const token = signToken({ userId: user.id, email: user.email });
    return res.json({ token, user: sanitizeUser(user) });
  } catch {
    return res.status(401).json({ error: 'Google Login fehlgeschlagen.' });
  }
});

app.post('/api/auth/oauth/apple', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '');
    const fullName = String(req.body?.fullName || '').trim();
    if (!idToken) return res.status(400).json({ error: 'Missing idToken.' });
    if (!appleAudience) return res.status(400).json({ error: 'APPLE_CLIENT_ID fehlt auf dem Server.' });

    const { payload } = await jwtVerify(idToken, appleJwks, {
      issuer: appleIssuer,
      audience: appleAudience,
    });

    const providerId = String(payload.sub || '');
    if (!providerId) return res.status(401).json({ error: 'Invalid Apple token.' });

    const user = upsertOauthUser({
      provider: 'apple',
      providerId,
      email: normalizeEmail(String(payload.email || '')),
      name: fullName || 'Apple User',
    });

    const token = signToken({ userId: user.id, email: user.email });
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth][apple] verify failed:', err?.message || err);
    return res.status(401).json({ error: 'Apple Login fehlgeschlagen. Bitte Apple-Konfiguration prüfen.' });
  }
});

app.get('/api/user/state', (req, res) => {
  const payload = getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const users = loadUsers();
  const user = users.find((u) => u.id === payload.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ state: user.state || {} });
});

app.put('/api/user/state', (req, res) => {
  const payload = getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const users = loadUsers();
  const index = users.findIndex((u) => u.id === payload.userId);
  if (index < 0) return res.status(401).json({ error: 'Unauthorized' });
  users[index] = {
    ...users[index],
    state: {
      ...(users[index].state || {}),
      ...(req.body?.state || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);
  return res.json({ ok: true });
});

app.post('/api/billing/create-checkout-session', async (req, res) => {
  try {
    const { tier, cycle } = req.body || {};
    if (!['pro', 'elite'].includes(tier)) {
      return res.status(400).json({ error: 'Only pro/elite are purchasable via Stripe.' });
    }
    if (!['monthly', 'yearly'].includes(cycle)) {
      return res.status(400).json({ error: 'Invalid billing cycle.' });
    }

    const priceId = PRICE_IDS[tier]?.[cycle];
    if (!priceId) {
      return res.status(400).json({ error: `Missing Stripe price id for ${tier}/${cycle}.` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      metadata: { tier, cycle, priceId },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (err) {
    const message = err?.message || 'Failed to create checkout session.';
    console.error('[billing] create-checkout-session error:', message);
    return res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Checkout konnte nicht gestartet werden.' : message,
    });
  }
});

app.get('/api/billing/checkout-session/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
      expand: ['line_items'],
    });

    const tier = inferTierFromSession(session);
    const cycle = inferCycleFromSession(session);
    return res.json({
      paid: session.payment_status === 'paid' || session.status === 'complete',
      tier,
      cycle,
      status: session.status,
    });
  } catch (err) {
    console.error('[billing] checkout-session lookup failed:', err.message);
    return res.status(500).json({ error: 'Failed to fetch checkout session.' });
  }
});

app.listen(port, () => {
  console.log(`[billing] listening on http://localhost:${port}`);
});
