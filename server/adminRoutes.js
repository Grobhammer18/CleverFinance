/**
 * Creator-Dashboard: /creator (UI) + /api/admin/* (JSON, geschützt).
 * Env: ADMIN_SECRET — nur du kennst dieses Passwort.
 */
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAdminOverview,
  listFeedback,
  listUsersForAdmin,
  listAffiliateStats,
  createAffiliateCode,
  FEEDBACK_KINDS,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function adminSecret() {
  return String(process.env.ADMIN_SECRET || '').trim();
}

function signAdminToken() {
  const secret = adminSecret();
  if (!secret) return null;
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyAdminToken(token) {
  const secret = adminSecret();
  if (!secret || !token?.includes('.')) return false;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload?.role === 'admin' && typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (!adminSecret()) {
    return res.status(503).json({ error: 'ADMIN_SECRET nicht gesetzt (Railway/Vercel Env).' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Admin ') ? auth.slice(6) : '';
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const KIND_LABELS = {
  bug: '🐛 Funktioniert nicht',
  improve: '✨ Verbesserung',
  feature: '💡 Wunsch',
  other: '💬 Sonstiges',
};

export function mountAdminRoutes(app) {
  app.get('/creator', (_req, res) => {
    res.sendFile(path.join(__dirname, 'creatorDashboard.html'));
  });

  app.post('/api/admin/login', (req, res) => {
    const secret = adminSecret();
    if (!secret) {
      return res.status(503).json({ error: 'ADMIN_SECRET fehlt auf dem Server.' });
    }
    const pw = String(req.body?.password || '');
    if (pw !== secret) {
      return res.status(401).json({ error: 'Falsches Passwort.' });
    }
    return res.json({ ok: true, token: signAdminToken() });
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    res.json(getAdminOverview());
  });

  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    res.json({ users: listUsersForAdmin(200) });
  });

  app.get('/api/admin/feedback', requireAdmin, (_req, res) => {
    res.json({ feedback: listFeedback(300) });
  });

  app.get('/api/admin/affiliates', requireAdmin, (_req, res) => {
    res.json({ codes: listAffiliateStats() });
  });

  app.post('/api/admin/affiliates', requireAdmin, (req, res) => {
    try {
      const code = createAffiliateCode({
        code: req.body?.code,
        label: req.body?.label,
        note: req.body?.note,
      });
      return res.json({ ok: true, code });
    } catch (e) {
      return res.status(400).json({ error: e.message || 'Fehler' });
    }
  });

  app.get('/api/admin/health', requireAdmin, (_req, res) => {
    res.json({ ok: true, feedbackKinds: [...FEEDBACK_KINDS] });
  });
}
