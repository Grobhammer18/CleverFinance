/**
 * SQLite-Datenbank für Clever Finance (Creator-Analytics, Feedback, Affiliates).
 * Datei: server/data/clever.db — auf Railway mit Volume mounten (gleicher Ordner wie users.json).
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.resolve('server/data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'clever.db');
const usersJsonFile = path.join(dataDir, 'users.json');
const feedbackJsonFile = path.join(dataDir, 'feedback.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const FEEDBACK_KINDS = new Set(['bug', 'improve', 'feature', 'other']);
const PING_SECONDS = 60;

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'User',
      password_hash TEXT,
      oauth_json TEXT NOT NULL DEFAULT '{}',
      state_json TEXT NOT NULL DEFAULT '{}',
      affiliate_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event_type TEXT NOT NULL,
      tab TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, created_at);

    CREATE TABLE IF NOT EXISTS usage_daily (
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      ping_count INTEGER NOT NULL DEFAULT 0,
      active_seconds INTEGER NOT NULL DEFAULT 0,
      last_tab TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS affiliate_codes (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      user_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
  `);
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    oauth: JSON.parse(row.oauth_json || '{}'),
    state: JSON.parse(row.state_json || '{}'),
    affiliateCode: row.affiliate_code || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userToRow(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || 'User',
    password_hash: user.passwordHash ?? null,
    oauth_json: JSON.stringify(user.oauth || {}),
    state_json: JSON.stringify(user.state || {}),
    affiliate_code: user.affiliateCode || null,
    created_at: user.createdAt || new Date().toISOString(),
    updated_at: user.updatedAt || new Date().toISOString(),
  };
}

function migrateFromJsonIfNeeded() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0 && fs.existsSync(usersJsonFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(usersJsonFile, 'utf8'));
      const users = Array.isArray(data.users) ? data.users : [];
      const ins = db.prepare(`
        INSERT OR IGNORE INTO users (id, email, name, password_hash, oauth_json, state_json, affiliate_code, created_at, updated_at)
        VALUES (@id, @email, @name, @password_hash, @oauth_json, @state_json, @affiliate_code, @created_at, @updated_at)
      `);
      for (const u of users) {
        ins.run(userToRow(u));
      }
      console.log(`[db] ${users.length} Nutzer aus users.json importiert`);
    } catch (e) {
      console.warn('[db] users.json Import fehlgeschlagen:', e.message);
    }
  }

  const fbCount = db.prepare('SELECT COUNT(*) AS c FROM feedback').get().c;
  if (fbCount === 0 && fs.existsSync(feedbackJsonFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(feedbackJsonFile, 'utf8'));
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const ins = db.prepare(`
        INSERT OR IGNORE INTO feedback (id, user_id, email, name, kind, message, created_at)
        VALUES (@id, @user_id, @email, @name, @kind, @message, @created_at)
      `);
      for (const e of entries) {
        ins.run({
          id: e.id || crypto.randomUUID(),
          user_id: e.userId,
          email: e.email,
          name: e.name || '',
          kind: e.kind || 'other',
          message: e.message,
          created_at: e.createdAt || new Date().toISOString(),
        });
      }
      console.log(`[db] ${entries.length} Feedback-Einträge importiert`);
    } catch (e) {
      console.warn('[db] feedback.json Import fehlgeschlagen:', e.message);
    }
  }
}

export function initDb() {
  initSchema();
  migrateFromJsonIfNeeded();
  console.log(`[db] SQLite bereit: ${dbPath}`);
}

export function loadUsers() {
  return db.prepare('SELECT * FROM users ORDER BY updated_at DESC').all().map(rowToUser);
}

export function findUserById(id) {
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function saveUser(user) {
  const row = userToRow({ ...user, updatedAt: new Date().toISOString() });
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, oauth_json, state_json, affiliate_code, created_at, updated_at)
    VALUES (@id, @email, @name, @password_hash, @oauth_json, @state_json, @affiliate_code, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      password_hash = excluded.password_hash,
      oauth_json = excluded.oauth_json,
      state_json = excluded.state_json,
      affiliate_code = excluded.affiliate_code,
      updated_at = excluded.updated_at
  `).run(row);
  try {
    fs.writeFileSync(usersJsonFile, JSON.stringify({ users: loadUsers() }, null, 2));
  } catch {
    /* backup optional */
  }
}

export function saveAllUsers(users) {
  const tx = db.transaction((list) => {
    for (const u of list) saveUser(u);
  });
  tx(users);
}

export function insertFeedback({ userId, email, name, kind, message }) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO feedback (id, user_id, email, name, kind, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, email, name || '', kind, message, createdAt);
  try {
    const entries = listFeedback(500);
    fs.writeFileSync(feedbackJsonFile, JSON.stringify({ entries: entries.map(feedbackToJson) }, null, 2));
  } catch {
    /* ignore */
  }
  return { id, createdAt };
}

function feedbackToJson(row) {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    kind: row.kind,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function listFeedback(limit = 200) {
  return db
    .prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?')
    .all(limit)
    .map(feedbackToJson);
}

export function recordEvent({ userId, eventType, tab, meta }) {
  db.prepare(`
    INSERT INTO usage_events (user_id, event_type, tab, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId || null, eventType, tab || null, meta ? JSON.stringify(meta) : null, new Date().toISOString());
}

export function recordUsagePing(userId, tab) {
  if (!userId) return;
  const day = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM usage_daily WHERE user_id = ? AND day = ?').get(userId, day);
  if (existing) {
    db.prepare(`
      UPDATE usage_daily SET
        ping_count = ping_count + 1,
        active_seconds = active_seconds + ?,
        last_tab = COALESCE(?, last_tab),
        updated_at = ?
      WHERE user_id = ? AND day = ?
    `).run(PING_SECONDS, tab || null, now, userId, day);
  } else {
    db.prepare(`
      INSERT INTO usage_daily (user_id, day, ping_count, active_seconds, last_tab, updated_at)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(userId, day, PING_SECONDS, tab || null, now);
  }
}

export function getAdminOverview() {
  const usersTotal = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const feedbackTotal = db.prepare('SELECT COUNT(*) AS c FROM feedback').get().c;
  const active7d = db
    .prepare(
      `SELECT COUNT(DISTINCT user_id) AS c FROM usage_daily WHERE day >= date('now', '-7 days')`,
    )
    .get().c;
  const minutesTotal = Math.round(
    (db.prepare('SELECT COALESCE(SUM(active_seconds), 0) AS s FROM usage_daily').get().s || 0) / 60,
  );
  const tabCounts = db
    .prepare(
      `SELECT last_tab AS tab, COUNT(*) AS c FROM usage_daily WHERE last_tab IS NOT NULL AND last_tab != '' GROUP BY last_tab ORDER BY c DESC LIMIT 12`,
    )
    .all();
  const feedbackByKind = db
    .prepare(`SELECT kind, COUNT(*) AS c FROM feedback GROUP BY kind ORDER BY c DESC`)
    .all();
  const signupsByDay = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS c FROM users WHERE created_at >= date('now', '-30 days') GROUP BY day ORDER BY day DESC LIMIT 14`,
    )
    .all();
  return {
    usersTotal,
    feedbackTotal,
    activeUsers7d: active7d,
    minutesTotal,
    tabCounts,
    feedbackByKind,
    signupsByDay,
  };
}

export function listUsersForAdmin(limit = 100) {
  return db
    .prepare(
      `
    SELECT u.id, u.email, u.name, u.created_at, u.updated_at, u.affiliate_code,
      COALESCE((SELECT SUM(active_seconds) FROM usage_daily d WHERE d.user_id = u.id), 0) AS active_seconds,
      COALESCE((SELECT SUM(ping_count) FROM usage_daily d WHERE d.user_id = u.id), 0) AS ping_count,
      (SELECT MAX(updated_at) FROM usage_daily d WHERE d.user_id = u.id) AS last_active
    FROM users u
    ORDER BY u.updated_at DESC
    LIMIT ?
  `,
    )
    .all(limit)
    .map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      affiliateCode: r.affiliate_code,
      minutes: Math.round((r.active_seconds || 0) / 60),
      pingCount: r.ping_count || 0,
      lastActive: r.last_active,
    }));
}

export function listAffiliateCodes() {
  return db.prepare('SELECT * FROM affiliate_codes ORDER BY created_at DESC').all();
}

export function createAffiliateCode({ code, label, note }) {
  const norm = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (norm.length < 3) throw new Error('Code mindestens 3 Zeichen (A-Z, 0-9, _, -).');
  db.prepare(
    `INSERT INTO affiliate_codes (code, label, note, active, created_at) VALUES (?, ?, ?, 1, ?)`,
  ).run(norm, label || '', note || '', new Date().toISOString());
  return norm;
}

export function attachReferral({ code, userId }) {
  const norm = String(code || '').trim().toUpperCase();
  const row = db.prepare('SELECT code FROM affiliate_codes WHERE code = ? AND active = 1').get(norm);
  if (!row) return false;
  const id = crypto.randomUUID();
  try {
    db.prepare(`INSERT INTO affiliate_referrals (id, code, user_id, created_at) VALUES (?, ?, ?, ?)`).run(
      id,
      norm,
      userId,
      new Date().toISOString(),
    );
    db.prepare('UPDATE users SET affiliate_code = ? WHERE id = ?').run(norm, userId);
    return true;
  } catch {
    return false;
  }
}

export function listAffiliateStats() {
  return db
    .prepare(
      `
    SELECT c.code, c.label, c.active, c.created_at,
      (SELECT COUNT(*) FROM affiliate_referrals r WHERE r.code = c.code) AS referrals
    FROM affiliate_codes c
    ORDER BY referrals DESC, c.created_at DESC
  `,
    )
    .all();
}

export { FEEDBACK_KINDS, dbPath };
