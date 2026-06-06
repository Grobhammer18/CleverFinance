import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import OnboardingWizard from './OnboardingWizard';
import type { LevelUpMode, OnboardingV2Payload } from '../onboarding/onboardingLogic';
import {
  notgroschenTargetFromIncome,
  resolveLevelUpMode,
  sharesFromOnboardingInvest,
} from '../onboarding/onboardingLogic';
import { APP_TOUR_STEPS, APP_TOUR_STORAGE_KEY } from '../onboarding/appGuideContent';
import AppGuideTour from './AppGuideTour';
import CleverFinanceLogo from './CleverFinanceLogo';
import MarketAssetIcon, { type MarketAssetLogoFields } from './MarketAssetIcon';
import HomeChartsSection from './homeCharts/HomeChartsSection';
import { MAX_DAILY_VERMOGEN_SNAPSHOTS, normalizeDailyVermogenSnapshots, inferChartTimelineEndMs, type DailyVermogenSnapshot } from './homeCharts/homeChartData';
import { allwinPalette as awBg } from '../theme/allwinPalette';
import { marketHistoryRange, sparkPricesFromHistory, type MarketDailyPrice } from '../marketHistory';
import { fetchInstrumentResolve, fetchMarketHistory, fetchMarketQuotes, type MarketInstrumentKind } from '../marketApi';
import { instrumentDisplayLines, isIsinCode, normalizeIsin } from '../instrumentDisplay';
import { stockLogoUrlCandidates } from '../stockLogos';
import {
  convertForeignToBase,
  fetchFxRate,
  formatForeignPaidLine,
  formatMoneyAmount,
  MONEY_CURRENCIES,
  moneyCurrencyLabel,
  moneyCurrencyOptionLabel,
  moneyCurrencySymbol,
  normalizeBaseCurrency,
} from '../currencyFx';
import { getOverviewDemoSnapshot, OVERVIEW_DEMO_HINT } from '../demo/overviewDemoSample';
import {
  PORTFOLIO_POWER_MILESTONE_EURS,
  highestPortfolioMilestoneCrossed,
  milestoneCelebrationMeta,
  portfolioPowerBadgeFor,
  type PortfolioPowerMilestone,
} from '../portfolioMilestones';
import {
  ORDEN_CATALOG,
  ORDEN_EARNED_STORAGE_KEY,
  normalizeEarnedOrdenOnLoad,
  portfolioEurToOrdenPresetId,
  readGuestEarnedOrdenPresetIds,
  sanitizeEarnedOrdenIds,
} from '../profileOrden';

const fmt = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

const fmtStk = (n: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(n);

function parseEuroInput(raw: string): number {
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return 0;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function normalizeMoneyDecimalInput(raw: string): string {
  let digitsBefore = '';
  let digitsAfter = '';
  let hasSep = false;
  for (const ch of String(raw).replace(/\s/g, '')) {
    if (ch >= '0' && ch <= '9') {
      if (!hasSep) digitsBefore += ch;
      else digitsAfter += ch;
    } else if ((ch === ',' || ch === '.') && !hasSep && digitsBefore.length > 0) {
      hasSep = true;
    }
  }
  return hasSep ? `${digitsBefore},${digitsAfter}` : digitsBefore;
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const CATS = {
  einnahmen: ['Gehalt', 'Trinkgeld', 'Gutschrift', 'Geschenk', 'Dividende', 'Zinsen', 'Freelance', 'Nebenjob', 'Sonstiges'],
  ausgaben: ['Essen & Trinken', 'Fahrtkosten', 'Abos', 'Kreditrate', 'Notgroschen', 'Miete', 'Kleidung', 'Gesundheit', 'Freizeit', 'Geschenk', 'Sonstiges'],
};

const PAYMENT_METHOD_OPTIONS = ['', 'Bar', 'Kreditkarte', 'Überweisung', 'Lastschrift', 'PayPal', 'Cash Depot', 'Einzahlung Cash Depot', 'Notgroschen', 'Sonstiges'] as const;

function readGuestDailyVermogenSnapshots(): DailyVermogenSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const token = localStorage.getItem('allwin.token');
    if (token && token.trim()) return [];
    return normalizeDailyVermogenSnapshots(JSON.parse(localStorage.getItem('allwin.dailyVermogenSnapshots') || 'null'));
  } catch {
    return [];
  }
}

/**
 * Billing-API Basis ohne trailing slash. Leer = gleicher Origin (`/api/...`, Vite-Proxy).
 * Wenn `.env` auf `http://localhost:4242` zeigt, die App aber über LAN-IP geöffnet ist, würde der Browser
 * `localhost` auf dem falschen Gerät ansprechen — im Dev weichen wir auf den Proxy aus.
 */
function onboardingDoneStorageKey(userId: string) {
  return `allwin.onboardingDone.${userId}`;
}

function onboardingDoneEmailKey(email: string) {
  return `allwin.onboardingDone.email.${email.trim().toLowerCase()}`;
}

function readLocalOnboardingDone(userId: string | undefined, email?: string | undefined) {
  try {
    if (userId && localStorage.getItem(onboardingDoneStorageKey(userId)) === '1') return true;
    if (email && localStorage.getItem(onboardingDoneEmailKey(email)) === '1') return true;
  } catch {
    return false;
  }
  return false;
}

function writeLocalOnboardingDone(userId: string | undefined, email?: string | undefined) {
  try {
    if (userId) localStorage.setItem(onboardingDoneStorageKey(userId), '1');
    if (email) localStorage.setItem(onboardingDoneEmailKey(email), '1');
  } catch {
    /* ignore */
  }
}

function celebratedPortfolioMilestonesKey(userId: string) {
  return `allwin.celebratedPortfolioMilestones.${userId}`;
}

function readCelebratedPortfolioMilestones(userId: string | undefined): Set<PortfolioPowerMilestone> {
  if (!userId) return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(celebratedPortfolioMilestonesKey(userId)) || '[]');
    if (!Array.isArray(raw)) return new Set();
    const allowed = new Set<number>(PORTFOLIO_POWER_MILESTONE_EURS);
    return new Set(raw.filter((m): m is PortfolioPowerMilestone => typeof m === 'number' && allowed.has(m)));
  } catch {
    return new Set();
  }
}

function writeCelebratedPortfolioMilestones(userId: string | undefined, milestones: Set<PortfolioPowerMilestone>) {
  if (!userId) return;
  try {
    localStorage.setItem(celebratedPortfolioMilestonesKey(userId), JSON.stringify([...milestones]));
  } catch {
    /* ignore */
  }
}

/** Bestehende Cloud-Daten ohne onboarding.done (Beta-Migration). */
function inferOnboardingDoneFromAppState(state: Record<string, unknown>): boolean {
  const hasDebts = Array.isArray(state.debts) && state.debts.length > 0;
  const hasTx = Array.isArray(state.transactions) && state.transactions.length > 0;
  const ng = state.notgroschen;
  const hasNg =
    ng != null &&
    typeof ng === 'object' &&
    (((ng as { balance?: unknown }).balance != null && Number((ng as { balance: number }).balance) > 0) ||
      ((ng as { target?: unknown }).target != null && Number((ng as { target: number }).target) > 0));
  const ps = state.portfolioShares;
  const hasPs = ps != null && typeof ps === 'object' && Object.keys(ps as object).length > 0;
  const port = state.portfolio;
  const hasPort = typeof port === 'number' && port > 0;
  return hasDebts || hasTx || hasNg || hasPs || hasPort;
}

/** Cloud + lokales Gerät: Onboarding gilt als erledigt. */
function resolveOnboardingDoneFromCloud(
  ob: unknown,
  userId: string | undefined,
  email?: string | undefined,
  fullState?: Record<string, unknown>,
): boolean {
  if (ob && typeof ob === 'object') {
    const o = ob as { done?: unknown; v2?: unknown };
    const obDone = o.done === true || o.done === 'true' || o.done === 1;
    const hasV2 = o.v2 != null && typeof o.v2 === 'object';
    if (obDone || hasV2) return true;
  }
  if (fullState && inferOnboardingDoneFromAppState(fullState)) return true;
  return readLocalOnboardingDone(userId, email);
}

function isMoneyCompactViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 640px)').matches;
}

function resolveBillingApiBase(): string {
  const raw = String(import.meta.env.VITE_BILLING_API_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (typeof window === 'undefined') return raw;
  if (!raw) return '';
  const host = window.location.hostname;
  const pageNotLoopback = Boolean(host && host !== 'localhost' && host !== '127.0.0.1');
  const billingTargetsLoopback = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(raw);
  if (import.meta.env.DEV && billingTargetsLoopback && pageNotLoopback) return '';
  return raw;
}

type Transaction = {
  id: number;
  type: 'einnahme' | 'ausgabe';
  amount: string;
  category: string;
  note: string;
  date: string;
  paymentMethod?: string;
  /** Bei Kreditrate: Tilgung dieser Schuld (Boost) */
  linkedDebtId?: number;
  linkedDebtName?: string;
  /** Ausgabe Kategorie Notgroschen: Betrag auf Home-Notgroschen gutgeschrieben */
  fillsNotgroschen?: boolean;
  /** Ausgabe mit Zahlungsart Notgroschen: Betrag vom Home-Notgroschen abgezogen */
  debitsNotgroschen?: boolean;
  /** Ausgabe mit Zahlungsart Cash Depot: Betrag vom LevelUp Broker-Cash abziehen */
  debitsCashDepot?: boolean;
  /** Ausgabe mit Einzahlung ins Cash Depot: Betrag wird dem Broker-Cash gutgeschrieben (Haushalt trotzdem als Ausgabe) */
  creditsCashDepot?: boolean;
  /** Optional: Gebühr/Steuer (z. B. Dividende brutto im Betrag, netto ins Cash Depot) */
  feeEur?: number;
  taxEur?: number;
  /** Bar/Reise: gezahlter Betrag in Fremdwährung (amount = EUR-Umrechnung) */
  foreignAmount?: number;
  foreignCurrency?: string;
  /** 1 Einheit foreignCurrency → EUR zum Buchungszeitpunkt */
  fxRateToEur?: number;
};

type MonthBucket = { einnahmen: number; ausgaben: number };

/** ISO `YYYY-MM-DD` oder deutsch `DD.MM.YYYY` (wie früher gespeichert). */
function parseTxDateParts(dateStr: string): { year: number; month0: number; day: number } | null {
  const s = String(dateStr || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const year = +s.slice(0, 4);
    const month = +s.slice(5, 7);
    const day = +s.slice(8, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month0: month - 1, day };
  }
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) {
    const day = +de[1];
    const month = +de[2];
    const year = +de[3];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month0: month - 1, day };
  }
  return null;
}

function parseTxYearMonth(dateStr: string): { year: number; month0: number } | null {
  const p = parseTxDateParts(dateStr);
  return p ? { year: p.year, month0: p.month0 } : null;
}

function aggregateByCalendarMonth(transactions: Transaction[], year: number): MonthBucket[] {
  const buckets: MonthBucket[] = Array.from({ length: 12 }, () => ({ einnahmen: 0, ausgaben: 0 }));
  for (const tx of transactions) {
    const ym = parseTxYearMonth(tx.date);
    if (!ym || ym.year !== year) continue;
    const amt = Math.abs(parseFloat(String(tx.amount).replace(',', '.')));
    if (Number.isNaN(amt)) continue;
    if (tx.type === 'einnahme') buckets[ym.month0].einnahmen += amt;
    else buckets[ym.month0].ausgaben += amt;
  }
  return buckets;
}

function formatTxDateLabel(dateStr: string): string {
  const parts = parseTxDateParts(dateStr);
  if (parts) {
    return new Date(parts.year, parts.month0, parts.day).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return dateStr;
}

/** Positiv, wenn b neuer ist als a (Kalenderdatum absteigend, bei Gleichstand id). */
function compareTxByDateDesc(a: Transaction, b: Transaction): number {
  const pa = parseTxDateParts(a.date);
  const pb = parseTxDateParts(b.date);
  const ta = pa ? pa.year * 10000 + (pa.month0 + 1) * 100 + pa.day : -1;
  const tb = pb ? pb.year * 10000 + (pb.month0 + 1) * 100 + pb.day : -1;
  if (tb !== ta) return tb - ta;
  return b.id - a.id;
}

/** @deprecated Alias — nutzt volles Datum, nicht nur Monat. */
function compareTxRecency(a: Transaction, b: Transaction): number {
  return compareTxByDateDesc(a, b);
}

function moneyTxMonthKey(year: number, month0: number) {
  return `${year}-${month0}`;
}

function moneyTxMonthLabel(year: number, month0: number) {
  return `${MONTHS[month0]} ${String(year).slice(-2)}`;
}

/** Ausgaben-Kategorien mit Positionsliste unter Money („laufende Fixkosten“). */
const FIXKOST_CATEGORIES = new Set(['Abos', 'Miete', 'Kreditrate']);

function fixedCostDedupeKey(t: Transaction): string {
  if (t.category === 'Kreditrate') {
    if (t.linkedDebtId != null) return `kr:${t.linkedDebtId}`;
    const name = (t.linkedDebtName || t.note || '').trim();
    return `krn:${name || 'unknown'}`;
  }
  if (t.category === 'Miete') return `mi:${(t.note || '').trim() || 'miete'}`;
  return `ab:${(t.note || '').trim() || 'abo'}`;
}

/** Titelzeile in der Fixkosten-Liste */
function formatFixedCostTitle(tx: Transaction): string {
  if (tx.category === 'Kreditrate') {
    return (tx.linkedDebtName || tx.note || '').trim() || 'Kreditrate';
  }
  if (tx.category === 'Miete') return (tx.note || '').trim() || 'Miete';
  return (tx.note || '').trim() || 'Ohne Bezeichnung';
}

function fixedCostKindShort(cat: string): string {
  if (cat === 'Kreditrate') return 'Kreditrate';
  if (cat === 'Miete') return 'Miete';
  return 'Abo';
}

/** Pro Position die neueste Ausgabe: Abos/Miete über Notizzeile, Kreditraten über verknüpfte Schuld (Boost). */
function latestFixedCostRows(transactions: Transaction[]): Transaction[] {
  const rows = transactions.filter((t) => t.type === 'ausgabe' && FIXKOST_CATEGORIES.has(t.category));
  const map = new Map<string, Transaction>();
  for (const t of rows) {
    const key = fixedCostDedupeKey(t);
    const prev = map.get(key);
    if (!prev || compareTxRecency(prev, t) < 0) map.set(key, t);
  }
  return Array.from(map.values()).sort((a, b) => compareTxRecency(b, a));
}

/** Abo/Miete/Kreditrate ausgeschlossen; Notgroschen (Polster) ebenfalls — typische variable Haushaltsausgaben. */
const VAR_KOST_CATEGORIES = new Set([
  'Essen & Trinken',
  'Fahrtkosten',
  'Kleidung',
  'Gesundheit',
  'Freizeit',
  'Geschenk',
  'Sonstiges',
]);

function varCostDedupeKey(t: Transaction): string {
  const n = (t.note || '').trim();
  return `v:${t.category}:${n || '_'}`;
}

function formatVarCostTitle(tx: Transaction): string {
  const n = (tx.note || '').trim();
  return n || 'Ohne Notiz';
}

/** Notiz-Vorschläge aus früheren Buchungen (ab 2 Zeichen, gleiche Kategorie zuerst). */
function noteAutocompleteSuggestions(
  transactions: Transaction[],
  type: 'einnahme' | 'ausgabe',
  category: string,
  query: string,
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const finalize = (list: string[]) =>
    list.filter((note) => note.trim().toLowerCase() !== q).slice(0, limit);
  const matches = (note: string) => {
    const n = note.toLowerCase();
    return n.startsWith(q) || n.includes(q);
  };
  const add = (raw: string) => {
    const note = raw.trim();
    if (note.length < 2) return;
    const key = note.toLowerCase();
    if (seen.has(key) || !matches(note)) return;
    seen.add(key);
    out.push(note);
  };
  for (const tx of transactions) {
    if (tx.type !== type || tx.category !== category) continue;
    add(tx.note || '');
    if (out.length >= limit) return finalize(out);
  }
  for (const tx of transactions) {
    if (tx.type !== type || tx.category === category) continue;
    add(tx.note || '');
    if (out.length >= limit) return finalize(out);
  }
  return finalize(out);
}

/** Pro Kategorie + Notiz die neueste variable Ausgabe. */
function latestVarCostRows(transactions: Transaction[]): Transaction[] {
  const rows = transactions.filter((t) => t.type === 'ausgabe' && VAR_KOST_CATEGORIES.has(t.category));
  const map = new Map<string, Transaction>();
  for (const t of rows) {
    const key = varCostDedupeKey(t);
    const prev = map.get(key);
    if (!prev || compareTxRecency(prev, t) < 0) map.set(key, t);
  }
  return Array.from(map.values()).sort((a, b) => compareTxRecency(b, a));
}

const INCOME_CATEGORIES = new Set(CATS.einnahmen);

function incomeDedupeKey(t: Transaction): string {
  const n = (t.note || '').trim();
  return `i:${t.category}:${n || '_'}`;
}

function formatIncomeTitle(tx: Transaction): string {
  const n = (tx.note || '').trim();
  return n || 'Ohne Notiz';
}

function parseIncomeAmount(amount: string): number {
  const n = Math.abs(parseFloat(String(amount).replace(/\s/g, '').replace(',', '.')));
  return Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function allIncomeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'einnahme' && INCOME_CATEGORIES.has(t.category));
}

/** Pro Kategorie + Notiz: Summe aller Buchungen (für Money-Liste & Übersicht). */
type IncomeAggRow = {
  key: string;
  category: string;
  title: string;
  sum: number;
  count: number;
  latest: Transaction;
};

function aggregatedIncomeRows(transactions: Transaction[]): IncomeAggRow[] {
  const map = new Map<string, IncomeAggRow>();
  for (const t of allIncomeTransactions(transactions)) {
    const key = incomeDedupeKey(t);
    const add = parseIncomeAmount(t.amount);
    if (add <= 0) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        key,
        category: t.category,
        title: formatIncomeTitle(t),
        sum: add,
        count: 1,
        latest: t,
      });
    } else {
      prev.sum = Math.round((prev.sum + add) * 100) / 100;
      prev.count += 1;
      if (compareTxRecency(prev.latest, t) < 0) prev.latest = t;
    }
  }
  return Array.from(map.values()).sort((a, b) => compareTxRecency(b.latest, a.latest));
}

function incomePieSlicesFromRows(rows: Transaction[]): { name: string; value: number }[] {
  const byCat = new Map<string, number>();
  for (const tx of rows) {
    const v = parseIncomeAmount(tx.amount);
    if (v <= 0) continue;
    byCat.set(tx.category, (byCat.get(tx.category) || 0) + v);
  }
  return Array.from(byCat.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

type Debt = {
  id: number;
  name: string;
  total: number;
  remaining: number;
  interest: number;
  monthly: number;
  /** Konsum/Dispo vs. Haus — für LevelUp-Freigabe-Logik */
  kind?: 'consumer' | 'house';
  /** Nur Hauskredit: aktueller Marktwert der Immobilie (Gegenwert) */
  propertyValue?: number;
  /** gesetzt wenn Rest = 0 → erscheint nur noch im Archiv */
  archivedAt?: string;
};

function debtPropertyValue(d: Debt): number {
  const v = d.propertyValue;
  return typeof v === 'number' && !Number.isNaN(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

/** Marktwert − Restschuld (nur Hauskredit mit hinterlegtem Wert). */
function debtEquity(d: Debt): number | null {
  if (d.kind !== 'house') return null;
  const pv = debtPropertyValue(d);
  if (pv <= 0) return null;
  return Math.round((pv - d.remaining) * 100) / 100;
}

function todayIsoDate() {
  return new Date().toLocaleDateString('sv-SE');
}

/** Kassenzettel-Foto für API verkleinern (max. Kantenlänge, JPEG). */
async function compressReceiptImageFile(file: File): Promise<{ base64: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
      el.src = url;
    });
    const maxDim = 1600;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error('Bild hat keine Größe.');
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Vorschau nicht möglich.');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const base64 = dataUrl.split(',')[1] || '';
    if (!base64) throw new Error('Komprimierung fehlgeschlagen.');
    return { base64, mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

type FormState = {
  type: 'einnahme' | 'ausgabe';
  amount: string;
  /** ISO-Währungscode; EUR = Betrag direkt in Euro */
  currency: string;
  category: string;
  note: string;
  date: string;
  paymentMethod: string;
  /** leer oder Debt-ID als String */
  linkedDebtId: string;
  feeStr: string;
  taxStr: string;
};

/** Offline-Backup pro User — überlebt Refresh, falls Cloud-Sync noch nicht fertig war. */
type UserStateCache = {
  transactions?: Transaction[];
  debts?: Debt[];
  notgroschenBalance?: number;
  notgroschenTarget?: number;
  portfolioBrokerCash?: number;
  levelUpMode?: LevelUpMode;
  baseCurrency?: string;
  savedAt?: number;
};

function userStateCacheKey(userId: string) {
  return `allwin.userCache.${userId}`;
}

function readUserStateCache(userId: string | undefined): UserStateCache | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(userStateCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as UserStateCache;
  } catch {
    return null;
  }
}

function writeUserStateCache(userId: string | undefined, patch: UserStateCache) {
  if (!userId) return;
  try {
    const prev = readUserStateCache(userId) || {};
    localStorage.setItem(
      userStateCacheKey(userId),
      JSON.stringify({ ...prev, ...patch, savedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

function userIdFromAuthToken(token: string | null | undefined): string | undefined {
  if (!token?.includes('.')) return undefined;
  try {
    const body = token.split('.')[0];
    const pad = body.length % 4 === 0 ? '' : '='.repeat(4 - (body.length % 4));
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const payload = JSON.parse(json) as { userId?: string };
    return typeof payload.userId === 'string' ? payload.userId : undefined;
  } catch {
    return undefined;
  }
}

function readInitialUserCache(): UserStateCache | null {
  if (typeof window === 'undefined') return null;
  return readUserStateCache(userIdFromAuthToken(localStorage.getItem('allwin.token')));
}

function deletedTxIdsStorageKey(userId: string) {
  return `allwin.deletedTxIds.${userId}`;
}

function readDeletedTxIds(userId: string | undefined): Set<number> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(deletedTxIdsStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => Number(x)).filter((n) => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

function writeDeletedTxIds(userId: string, ids: Set<number>) {
  try {
    localStorage.setItem(deletedTxIdsStorageKey(userId), JSON.stringify([...ids].slice(-800)));
  } catch {
    /* ignore */
  }
}

function markTxDeleted(userId: string | undefined, id: number) {
  if (!userId || !Number.isFinite(id)) return;
  const next = readDeletedTxIds(userId);
  next.add(id);
  writeDeletedTxIds(userId, next);
}

/** Cloud-Transaktionen normalisieren (Sortierung); Merge mit Cache in loadUserState / pullMoneyFromCloud. */
function transactionsFromCloud(cloud: Transaction[]): Transaction[] {
  return [...cloud].sort(compareTxByDateDesc);
}

function debtsFromCloud(cloud: Debt[]): Debt[] {
  return cloud.map((d) => ({ ...d, kind: d.kind === 'house' ? 'house' : 'consumer' }));
}

/** Cache ergänzt nur fehlende ids; Gelöschte bleiben ausgeschlossen. */
function mergeTransactionsById(cloud: Transaction[], cached: Transaction[], userId?: string): Transaction[] {
  const deleted = readDeletedTxIds(userId);
  const cloudIds = new Set(cloud.map((t) => t.id));
  for (const id of [...deleted]) {
    if (!cloudIds.has(id)) deleted.delete(id);
  }
  if (userId) writeDeletedTxIds(userId, deleted);

  const byId = new Map<number, Transaction>();
  for (const t of cloud) {
    if (!deleted.has(t.id)) byId.set(t.id, t);
  }
  for (const t of cached) {
    if (deleted.has(t.id)) {
      byId.delete(t.id);
      continue;
    }
    byId.set(t.id, t);
  }
  return [...byId.values()].sort(compareTxByDateDesc);
}

function mergeDebtsById(cloud: Debt[], cached: Debt[]): Debt[] {
  const byId = new Map<number, Debt>();
  for (const d of cached) byId.set(d.id, d);
  for (const d of cloud) byId.set(d.id, d);
  return [...byId.values()];
}

function txAmountNum(tx: Transaction): number {
  return Math.round(parseFloat(String(tx.amount).replace(',', '.')) * 100) / 100;
}

function txDateToInputValue(dateStr: string): string {
  const s = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) {
    const day = de[1].padStart(2, '0');
    const month = de[2].padStart(2, '0');
    return `${de[3]}-${month}-${day}`;
  }
  return todayIsoDate();
}

/** Storniert die Seiteneffekte einer Buchung (Gegenteil von addTx). */
function reverseTxSideEffects(
  tx: Transaction,
  debts: Debt[],
  notgroschenBalance: number,
  portfolioBrokerCash: number,
): { debts: Debt[]; notgroschenBalance: number; portfolioBrokerCash: number } {
  const amt = txAmountNum(tx);
  let nextDebts = debts;
  let ng = notgroschenBalance;
  let broker = portfolioBrokerCash;

  if (tx.type === 'ausgabe' && tx.category === 'Kreditrate' && tx.linkedDebtId != null) {
    nextDebts = debts.map((d) => {
      if (d.id !== tx.linkedDebtId) return d;
      const restored = Math.min(d.total, Math.round((d.remaining + amt) * 100) / 100);
      if (restored > 0 && d.archivedAt) {
        const { archivedAt: _arch, ...rest } = d;
        return { ...rest, remaining: restored };
      }
      return { ...d, remaining: restored };
    });
  }
  if (tx.type === 'ausgabe' && tx.category === 'Notgroschen' && tx.fillsNotgroschen) {
    ng = Math.round((ng - amt) * 100) / 100;
  }
  if (tx.type === 'ausgabe' && tx.debitsNotgroschen) {
    ng = Math.round((ng + amt) * 100) / 100;
  }
  if (tx.type === 'ausgabe' && tx.debitsCashDepot) {
    broker = Math.round((broker + amt) * 100) / 100;
  }
  if (tx.type === 'ausgabe' && tx.creditsCashDepot) {
    broker = Math.round((broker - amt) * 100) / 100;
  }
  if (tx.type === 'einnahme' && tx.category === 'Dividende') {
    const fee = Math.max(0, tx.feeEur ?? 0);
    const tax = Math.max(0, tx.taxEur ?? 0);
    const net = Math.round((amt - fee - tax) * 100) / 100;
    broker = Math.round((broker - net) * 100) / 100;
  }
  return {
    debts: nextDebts,
    notgroschenBalance: Math.max(0, ng),
    portfolioBrokerCash: Math.max(0, broker),
  };
}

type ToastState = {
  msg: string;
  type: 'success' | 'error' | 'level';
} | null;

type MarketItem = {
  sym: string;
  name: string;
  price: number;
  change: number;
  icon: string;
  kind: MarketInstrumentKind;
  /** Markenlogo (CDN) — Krypto oft CoinGecko, Aktien/Titel z. B. FMP oder Wikimedia. */
  logoUrl?: string;
  logoUrlFallbacks?: string[];
  /** Tages-Schlusskurse (älteste zuerst), vom Server. */
  historyDaily?: MarketDailyPrice[];
  historySource?: string;
  quoteSource?: string;
};

type SubscriptionTier = 'free' | 'pro' | 'elite';
type BillingCycle = 'monthly' | 'yearly';

type SubscriptionState = {
  tier: SubscriptionTier;
  cycle: BillingCycle;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const PRICING = {
  free: { monthly: 0, yearly: 0, name: 'Finance Free', features: ['Basis Tracking', 'Buchungen', 'Schulden-Tracker'] },
  pro: { monthly: 9.99, yearly: 99.99, name: 'Finance Pro', features: ['Live Marktdaten', 'Jahres-Insights', 'Portfolio-Übersicht'] },
  elite: { monthly: 19.99, yearly: 199.99, name: 'Finance Elite', features: ['Alles aus Finance Pro', 'Priorität', 'Advanced Analytics'] },
};

/** Öffentliche Testphase: alles kostenlos, keine Stripe-Checkout-Buttons (siehe docs/BETA_LAUNCH.md). */
const PUBLIC_BETA = import.meta.env.VITE_PUBLIC_BETA === '1' || import.meta.env.VITE_PUBLIC_BETA === 'true';
/** Lokal wie Elite: Live-Markt u. a. frei. In `npm run dev` standardmäßig an; mit `VITE_DEV_FORCE_ELITE=0` aus. Für Preview/Build: `VITE_DEV_FORCE_ELITE=1`. */
const rawDevForceElite = import.meta.env.VITE_DEV_FORCE_ELITE;
const DEV_FORCE_ELITE =
  PUBLIC_BETA ||
  rawDevForceElite === '1' ||
  rawDevForceElite === 'true' ||
  (import.meta.env.DEV && rawDevForceElite !== '0' && rawDevForceElite !== 'false');

const BASE_MARKET: MarketItem[] = [
  {
    sym: 'BTC',
    name: 'Bitcoin',
    price: 0,
    change: 0,
    kind: 'crypto',
    icon: '₿',
    logoUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  },
  {
    sym: 'ETH',
    name: 'Ethereum',
    price: 0,
    change: 0,
    kind: 'crypto',
    icon: 'Ξ',
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    sym: 'SPY',
    name: 'S&P 500 ETF',
    price: 0,
    change: 0,
    kind: 'stock',
    icon: '📈',
    logoUrl: 'https://financialmodelingprep.com/image-stock/SPY.png',
  },
  {
    sym: 'AAPL',
    name: 'Apple',
    price: 0,
    change: 0,
    kind: 'stock',
    icon: '🍎',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Apple_logo_white.svg',
  },
  {
    sym: 'MSCI',
    name: 'MSCI World (IWDA)',
    price: 0,
    change: 0,
    kind: 'stock',
    icon: '🌍',
    logoUrl: 'https://financialmodelingprep.com/image-stock/IWDA.AS.png',
  },
];

/** Vom Nutzer ergänzte Wertpapiere/Krypto (watchlistExtras im User-State + localStorage). */
type WatchlistExtraPersist = {
  sym: string;
  name: string;
  kind: 'stock' | 'crypto';
  /** Ursprüngliche ISIN, wenn per OpenFIGI auf Börsen-Kürzel gemappt. */
  isin?: string;
  logoUrl?: string;
  logoUrlFallbacks?: string[];
  /** Nur Live-Watchlist — kein Eintrag unter Portfolio Power / Order. */
  watchlistOnly?: boolean;
};

const BASE_SYM_SET = new Set(BASE_MARKET.map((m) => m.sym));

const CRYPTOCURRENCY_ICONS_RAW =
  'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';

function readWatchlistExtrasFromLocal(): WatchlistExtraPersist[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    return normalizeWatchlistExtrasPersist(JSON.parse(localStorage.getItem('allwin.watchlistExtras') || 'null'));
  } catch {
    return [];
  }
}

function normalizePortfolioExcludedBaseSyms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const s = typeof row === 'string' ? sanitizeWatchlistSymbol(row) : null;
    if (!s || !BASE_SYM_SET.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, 32);
}

function readPortfolioExcludedBaseFromLocal(): string[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    return normalizePortfolioExcludedBaseSyms(JSON.parse(localStorage.getItem('allwin.portfolioExcludedBaseSyms') || 'null'));
  } catch {
    return [];
  }
}

function sanitizeWatchlistSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!s || s.length > 12) return null;
  return s;
}

function normalizeWatchlistExtrasPersist(raw: unknown): WatchlistExtraPersist[] {
  if (!Array.isArray(raw)) return [];
  const out: WatchlistExtraPersist[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const sym = sanitizeWatchlistSymbol(typeof r.sym === 'string' ? r.sym : '');
    if (!sym || seen.has(sym) || BASE_SYM_SET.has(sym)) continue;
    const nameRaw = typeof r.name === 'string' ? r.name.trim().slice(0, 56) : '';
    const kind = r.kind === 'crypto' ? 'crypto' : 'stock';
    const watchlistOnly = r.watchlistOnly === true ? true : undefined;
    seen.add(sym);
    const isinRaw = typeof r.isin === 'string' ? normalizeIsin(r.isin) : '';
    const logoUrl = typeof r.logoUrl === 'string' && r.logoUrl.trim() ? r.logoUrl.trim() : undefined;
    const logoUrlFallbacks = Array.isArray(r.logoUrlFallbacks)
      ? r.logoUrlFallbacks
          .filter((u): u is string => typeof u === 'string' && !!u.trim())
          .map((u) => u.trim())
          .slice(0, 8)
      : [];
    out.push({
      sym,
      name: nameRaw || sym,
      kind,
      ...(isinRaw ? { isin: isinRaw } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      ...(logoUrlFallbacks.length ? { logoUrlFallbacks } : {}),
      ...(watchlistOnly ? { watchlistOnly: true } : {}),
    });
  }
  return out.slice(0, 40);
}

function instrumentNameNeedsRefresh(sym: string, name?: string): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (n.toUpperCase() === sym.toUpperCase()) return true;
  return /^[A-Z0-9]{1,6}(\.[A-Z]{1,3})?$/.test(n.toUpperCase());
}

function mergeLogoCandidates(primary: string | undefined, fallbacks: string[] | undefined, computed: string[]): string[] {
  const out: string[] = [];
  const add = (url: string | undefined) => {
    const t = url?.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const u of computed) add(u);
  add(primary);
  if (fallbacks?.length) for (const u of fallbacks) add(u);
  return out.slice(0, 10);
}

function provisionalLogoFields(symRaw: string, kind: 'stock' | 'crypto', name?: string): MarketAssetLogoFields {
  const sym = sanitizeWatchlistSymbol(symRaw) || symRaw.trim().toUpperCase().slice(0, 16) || '?';
  return buildMarketItemFromExtra({ sym, name: name?.trim() || sym, kind });
}

function buildMarketItemFromExtra(extra: WatchlistExtraPersist): MarketItem {
  const sym = sanitizeWatchlistSymbol(extra.sym) || extra.sym.trim().toUpperCase();
  const name =
    typeof extra.name === 'string' && extra.name.trim() ? extra.name.trim().slice(0, 56) : sym;
  const kind = extra.kind === 'crypto' ? 'crypto' : 'stock';
  const slugLower = sym.split('.')[0].toLowerCase().replace(/\./g, '');
  const icon = kind === 'crypto' ? '◆' : '◈';
  if (kind === 'crypto') {
    const logoUrl = extra.logoUrl || `${CRYPTOCURRENCY_ICONS_RAW}/${slugLower}.png`;
    return { sym, name, price: 0, change: 0, kind, icon, logoUrl, logoUrlFallbacks: extra.logoUrlFallbacks };
  }
  const candidates = mergeLogoCandidates(extra.logoUrl, extra.logoUrlFallbacks, stockLogoUrlCandidates(sym));
  const logoUrl = candidates[0];
  const logoUrlFallbacks = candidates.slice(1);
  return { sym, name, price: 0, change: 0, kind, icon, logoUrl, logoUrlFallbacks };
}

function instrumentMetaForSym(
  sym: string,
  market: MarketItem[],
  extras: WatchlistExtraPersist[],
): { sym: string; name: string; isin?: string } {
  const m = market.find((x) => x.sym === sym);
  const ex = extras.find((e) => e.sym === sym);
  return {
    sym,
    name: m?.name || ex?.name || sym,
    isin: ex?.isin,
  };
}

function marketKindForItem(sym: string, extras: WatchlistExtraPersist[]): MarketInstrumentKind {
  const base = BASE_MARKET.find((m) => m.sym === sym);
  if (base) return base.kind;
  const ex = extras.find((e) => sanitizeWatchlistSymbol(e.sym) === sym);
  return ex?.kind === 'crypto' ? 'crypto' : 'stock';
}

function mergedWatchlistFromExtras(extras: WatchlistExtraPersist[]): MarketItem[] {
  const out = [...BASE_MARKET];
  for (const x of extras) {
    const sym = sanitizeWatchlistSymbol(x.sym);
    if (!sym || BASE_SYM_SET.has(sym)) continue;
    if (out.some((o) => o.sym === sym)) continue;
    out.push(buildMarketItemFromExtra({ ...x, sym }));
  }
  return out;
}

/** Für Portfolio-Power / Order: Basis + eigene Instrumente ohne watchlistOnly. */
function tradableMergedFromExtras(extras: WatchlistExtraPersist[]): MarketItem[] {
  return mergedWatchlistFromExtras(extras.filter((e) => e.watchlistOnly !== true));
}

function defaultPortfolioAllocFor(instruments: MarketItem[]): Record<string, number> {
  const n = instruments.length || 1;
  const w = 1 / n;
  const alloc: Record<string, number> = {};
  instruments.forEach((m) => {
    alloc[m.sym] = w;
  });
  return alloc;
}

function normalizePortfolioAlloc(raw: unknown, instruments: MarketItem[]): Record<string, number> {
  if (!raw || typeof raw !== 'object') return defaultPortfolioAllocFor(instruments);
  const o = raw as Record<string, unknown>;
  const merged: Record<string, number> = {};
  for (const m of instruments) {
    const v = o[m.sym];
    merged[m.sym] = typeof v === 'number' && v >= 0 && !Number.isNaN(v) ? v : 0;
  }
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  if (sum <= 0) return defaultPortfolioAllocFor(instruments);
  for (const k of Object.keys(merged)) merged[k] = merged[k] / sum;
  return merged;
}

function portfolioEuroValue(shares: Record<string, number>, prices: MarketItem[]) {
  return prices.reduce((s, m) => s + (shares[m.sym] ?? 0) * m.price, 0);
}

function valueWeightsFromShares(shares: Record<string, number>, prices: MarketItem[]): Record<string, number> {
  const total = portfolioEuroValue(shares, prices);
  const w: Record<string, number> = {};
  for (const m of prices) w[m.sym] = total > 1e-12 ? ((shares[m.sym] ?? 0) * m.price) / total : 0;
  return w;
}

function defaultPortfolioSharesFor(instruments: MarketItem[]): Record<string, number> {
  const eurTarget = 8400;
  const alloc = defaultPortfolioAllocFor(instruments);
  const out: Record<string, number> = {};
  for (const m of instruments) {
    const eur = eurTarget * (alloc[m.sym] ?? 0);
    out[m.sym] = m.price > 0 ? eur / m.price : 0;
  }
  return out;
}

function normalizePortfolioShares(raw: unknown, instruments: MarketItem[]): Record<string, number> {
  if (!raw || typeof raw !== 'object') return defaultPortfolioSharesFor(instruments);
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const m of instruments) {
    const v = o[m.sym];
    out[m.sym] = typeof v === 'number' && v >= 0 && !Number.isNaN(v) ? v : 0;
  }
  return out;
}

function sharesFromLegacyEuro(portfolioEur: number, alloc: Record<string, number>, prices: MarketItem[]) {
  const out: Record<string, number> = {};
  for (const m of prices) {
    const pr = m.price;
    const eur = portfolioEur * (alloc[m.sym] ?? 0);
    out[m.sym] = pr > 0 ? eur / pr : 0;
  }
  return out;
}

/** amount = Stückzahl; optional Kurs zum Orderzeitpunkt (Einstandslogik). */
type PortfolioTrade = {
  id: string;
  at: string;
  kind: 'buy' | 'sell';
  sym: string;
  amount: number;
  pricePerShareEur?: number;
  totalEur?: number;
  feeEur?: number;
  taxEur?: number;
};

function tradeOrderEur(t: PortfolioTrade): number | null {
  if (typeof t.totalEur === 'number' && !Number.isNaN(t.totalEur) && t.totalEur >= 0) return t.totalEur;
  const p = t.pricePerShareEur;
  if (typeof p === 'number' && !Number.isNaN(p) && p > 0) return t.amount * p;
  return null;
}

/** Kauf: Gebühren erhöhen die Einstandskosten; Verkauf/Dividende: Gebühr+Steuer mindern Cash. */
function tradeCashDelta(t: PortfolioTrade): number {
  const gross = tradeOrderEur(t) ?? 0;
  const fee = Math.max(0, t.feeEur ?? 0);
  const tax = Math.max(0, t.taxEur ?? 0);
  if (t.kind === 'buy') return -(gross + fee + tax);
  return gross - fee - tax;
}

function tradeCostBasisEur(t: PortfolioTrade): number | null {
  const gross = tradeOrderEur(t);
  if (gross == null) return null;
  if (t.kind === 'buy') return gross + Math.max(0, t.feeEur ?? 0);
  return gross;
}

/** trades: neueste zuerst (wie im State). */
function fifoSharesAndCost(tradesNewestFirst: PortfolioTrade[], sym: string): { shares: number; costEur: number; avgPerShare: number | null } {
  const seq = [...tradesNewestFirst].filter((t) => t.sym === sym).reverse();
  let shares = 0;
  let cost = 0;
  for (const t of seq) {
    const eu = t.kind === 'buy' ? tradeCostBasisEur(t) : tradeOrderEur(t);
    if (t.kind === 'buy') {
      if (eu == null) continue;
      shares += t.amount;
      cost += eu;
    } else {
      if (shares <= 0) continue;
      const avg = cost / shares;
      const sold = Math.min(t.amount, shares);
      shares -= sold;
      cost -= sold * avg;
    }
  }
  const avgPerShare = shares > 1e-9 ? cost / shares : null;
  return { shares, costEur: Math.max(0, cost), avgPerShare };
}

function roundTradeEur(v: number) {
  return Math.round(v * 100) / 100;
}

/** Depot-Buchung rückgängig (für Löschen / Bearbeiten). */
function reverseTradeOnPortfolio(
  t: PortfolioTrade,
  shares: Record<string, number>,
  cash: number,
): { shares: Record<string, number>; cash: number } {
  const next = { ...shares };
  if (t.kind === 'buy') {
    next[t.sym] = Math.max(0, (next[t.sym] ?? 0) - t.amount);
    if ((next[t.sym] ?? 0) <= 1e-12) delete next[t.sym];
    return { shares: next, cash: roundTradeEur(cash - tradeCashDelta(t)) };
  }
  next[t.sym] = (next[t.sym] ?? 0) + t.amount;
  return { shares: next, cash: Math.max(0, roundTradeEur(cash - tradeCashDelta(t))) };
}

/** Depot-Buchung auf Bestand/Cash anwenden (nach Bearbeiten). */
function applyTradeOnPortfolio(
  t: PortfolioTrade,
  shares: Record<string, number>,
  cash: number,
): { shares: Record<string, number>; cash: number } {
  const next = { ...shares };
  if (t.kind === 'buy') {
    next[t.sym] = (next[t.sym] ?? 0) + t.amount;
    return { shares: next, cash: Math.max(0, roundTradeEur(cash + tradeCashDelta(t))) };
  }
  next[t.sym] = Math.max(0, (next[t.sym] ?? 0) - t.amount);
  if ((next[t.sym] ?? 0) <= 1e-12) delete next[t.sym];
  return { shares: next, cash: roundTradeEur(cash + tradeCashDelta(t)) };
}

const ADD_INSTRUMENT_SELECT_VALUE = '__cf_add_instrument__';

function normalizePortfolioTrades(raw: unknown, allowedSyms: Set<string>): PortfolioTrade[] {
  if (!Array.isArray(raw)) return [];
  const out: PortfolioTrade[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : String(r.id ?? '');
    const at = typeof r.at === 'string' ? r.at : '';
    const kind = r.kind === 'sell' ? 'sell' : 'buy';
    const sym = typeof r.sym === 'string' ? r.sym : '';
    const amount = typeof r.amount === 'number' && r.amount > 0 && !Number.isNaN(r.amount) ? r.amount : 0;
    if (!sym || !allowedSyms.has(sym) || amount <= 0) continue;
    const ppsRaw = r.pricePerShareEur ?? r.pricePerShare;
    const pricePerShareEur =
      typeof ppsRaw === 'number' && !Number.isNaN(ppsRaw) && ppsRaw >= 0 ? ppsRaw : undefined;
    const totalRaw = r.totalEur;
    const totalEur = typeof totalRaw === 'number' && !Number.isNaN(totalRaw) && totalRaw >= 0 ? totalRaw : undefined;
    const feeRaw = r.feeEur;
    const taxRaw = r.taxEur;
    const feeEur =
      typeof feeRaw === 'number' && !Number.isNaN(feeRaw) && feeRaw >= 0 ? feeRaw : undefined;
    const taxEur =
      typeof taxRaw === 'number' && !Number.isNaN(taxRaw) && taxRaw >= 0 ? taxRaw : undefined;
    out.push({
      id: id || `${sym}-${at}-${amount}`,
      at,
      kind,
      sym,
      amount,
      pricePerShareEur,
      totalEur,
      feeEur,
      taxEur,
    });
  }
  return out.slice(0, 60);
}

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div style={{ background: '#1c1c24', borderRadius: 99, height: 6, overflow: 'hidden' }}>
    <div
      style={{
        width: `${Math.min(pct, 100)}%`,
        height: '100%',
        background: color,
        borderRadius: 99,
      }}
    />
  </div>
);

const Spark = ({ data, color }: { data: number[]; color: string }) => {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const denom = Math.max(1, data.length - 1);
  const pts = data
    .map((v, i) => {
      const x = (i / denom) * 80;
      const y = 30 - ((v - min) / (max - min + 1)) * 28;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 80 32" width="80" height="32">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

type ConfettiPiece = { left: number; delay: number; duration: number; drift: number; rot: number; hue: string; w: number; h: number };

function buildConfettiPieces(seed: number, count: number): ConfettiPiece[] {
  let s = seed % 2147483646 || 1;
  const rnd = () => {
    s = (s * 48271) % 2147483647;
    return (s % 10000) / 10000;
  };
  const hues = ['#2563eb', '#93c5fd', '#a855f7', '#5b93ff', '#00d4aa', '#f8d03a'];
  return Array.from({ length: count }, (_, i) => ({
    left: rnd() * 100,
    delay: rnd() * 0.35,
    duration: 1.6 + rnd() * 0.9,
    drift: (rnd() - 0.5) * 140,
    rot: 180 + rnd() * 360,
    hue: hues[i % hues.length],
    w: 4 + rnd() * 4,
    h: 5 + rnd() * 6,
  }));
}

/** Meilenstein-Popup: sachlicher Text, dezentes Einblenden + wenig Konfetti. */
function CelebrationCard({
  open,
  onClose,
  zIndex,
  title,
  body,
  actionLabel,
  icon,
  accent = '#2563eb',
  confettiCount = 16,
}: {
  open: boolean;
  onClose: () => void;
  zIndex: number;
  title: string;
  body: string;
  actionLabel: string;
  icon?: string;
  accent?: string;
  confettiCount?: number;
}) {
  const [animSeed, setAnimSeed] = useState(0);
  useEffect(() => {
    if (open) setAnimSeed(Date.now());
  }, [open]);
  const pieces = useMemo(() => buildConfettiPieces(animSeed, confettiCount), [animSeed, confettiCount]);

  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(0,0,0,0.72)',
        animation: 'awCelebrationFadeIn 0.28s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes awCelebrationFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes awCelebrationPop {
          from { transform: scale(0.94) translateY(8px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes awCelebrationConfetti {
          from { transform: translate3d(0, -8px, 0) rotate(0deg); opacity: 0.9; }
          to { transform: translate3d(var(--drift), 70vh, 0) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>

      {confettiCount > 0 ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' as const }}>
          {pieces.map((p, i) => (
            <div
              key={i}
              style={
                {
                  position: 'absolute',
                  left: `${p.left}%`,
                  top: '-2%',
                  width: p.w,
                  height: p.h,
                  borderRadius: 2,
                  background: p.hue,
                  opacity: 0.85,
                  animation: `awCelebrationConfetti ${p.duration}s ease-out forwards`,
                  animationDelay: `${p.delay}s`,
                  ['--drift' as string]: `${p.drift}px`,
                  ['--rot' as string]: `${p.rot}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: 380,
          width: '100%',
          borderRadius: 16,
          padding: '24px 20px',
          background: '#161b22',
          border: `1px solid #30363d`,
          borderTop: `3px solid ${accent}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          animation: 'awCelebrationPop 0.38s ease-out forwards',
        }}
      >
        {icon ? (
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10, textAlign: 'center' as const }}>{icon}</div>
        ) : null}
        <div style={{ fontSize: 18, fontWeight: 800, color: '#e6edf3', lineHeight: 1.35, textAlign: icon ? ('center' as const) : undefined }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#8b949e', marginTop: 10, lineHeight: 1.55, textAlign: icon ? ('center' as const) : undefined }}>
          {body}
        </div>
        <button
          type="button"
          style={{
            marginTop: 20,
            width: '100%',
            padding: '12px 18px',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            color: '#0d1117',
            background: accent,
          }}
          onClick={onClose}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function DebtZeroVictoryOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CelebrationCard
      open={open}
      onClose={onClose}
      zIndex={5000}
      icon="🏆"
      accent="#f8d03a"
      confettiCount={18}
      title="Alle Schulden abbezahlt"
      body="Du hast alle offenen Boost-Schulden tilgt. Guter Meilenstein — als Nächstes lohnt sich konsequent Sparen und Investieren."
      actionLabel="Weiter"
    />
  );
}

function NotgroschenFullOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CelebrationCard
      open={open}
      onClose={onClose}
      zIndex={5001}
      icon="🛡️"
      accent="#5b93ff"
      confettiCount={16}
      title="Notgroschen am Ziel"
      body="Dein Polster entspricht jetzt deinem Zielbetrag. Damit bist du für unerwartete Ausgaben besser abgesichert."
      actionLabel="Verstanden"
    />
  );
}

function PortfolioPowerMilestoneOverlay({
  open,
  milestone,
  onClose,
}: {
  open: boolean;
  milestone: PortfolioPowerMilestone;
  onClose: () => void;
}) {
  const meta = milestoneCelebrationMeta(milestone);
  return (
    <CelebrationCard
      open={open}
      onClose={onClose}
      zIndex={5002}
      icon={meta.icon}
      accent={meta.accent}
      confettiCount={meta.confetti}
      title={meta.headline}
      body={meta.sub}
      actionLabel={meta.btn}
    />
  );
}

/** Kurze Hash-Links zum Vorzeigen, z. B. `#boost`, `#levelup` — siehe `tabToDisplayHash`. */
const ALLWIN_TAB_IDS = ['dashboard', 'transactions', 'charts', 'debts', 'invest', 'profile'] as const;

function parseAllwinTabHash(): (typeof ALLWIN_TAB_IDS)[number] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  if (!raw) return null;
  const aliases: Record<string, (typeof ALLWIN_TAB_IDS)[number]> = {
    home: 'dashboard',
    dashboard: 'dashboard',
    money: 'transactions',
    transactions: 'transactions',
    uebersicht: 'charts',
    übersicht: 'charts',
    charts: 'charts',
    diagramme: 'charts',
    auswertung: 'charts',
    boost: 'debts',
    schulden: 'debts',
    debts: 'debts',
    levelup: 'invest',
    invest: 'invest',
    profile: 'profile',
    mehr: 'profile',
  };
  if (aliases[raw]) return aliases[raw];
  if ((ALLWIN_TAB_IDS as readonly string[]).includes(raw)) return raw as (typeof ALLWIN_TAB_IDS)[number];
  return null;
}

function tabToDisplayHash(tab: string): string {
  const m: Record<string, string> = {
    dashboard: 'home',
    transactions: 'money',
    charts: 'uebersicht',
    debts: 'boost',
    invest: 'levelup',
    profile: 'mehr',
  };
  return m[tab] ?? tab;
}

export default function AllWin() {
  const BILLING_API = resolveBillingApiBase();
  const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const APPLE_CLIENT_ID = (import.meta as any).env?.VITE_APPLE_CLIENT_ID || '';
  const APPLE_REDIRECT_URI = (import.meta as any).env?.VITE_APPLE_REDIRECT_URI || window.location.origin;
  const [tab, setTab] = useState(() => parseAllwinTabHash() ?? 'dashboard');
  const _bootCache = readInitialUserCache();
  const _bootBaseCurrency = normalizeBaseCurrency(_bootCache?.baseCurrency);
  const [baseCurrency, setBaseCurrency] = useState(_bootBaseCurrency);
  const [debts, setDebts] = useState<Debt[]>(() =>
    Array.isArray(_bootCache?.debts)
      ? _bootCache.debts.map((d) => ({ ...d, kind: d.kind === 'house' ? 'house' : 'consumer' }))
      : [],
  );
  const [debtAddOpen, setDebtAddOpen] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtTotal, setNewDebtTotal] = useState('');
  const [newDebtInterest, setNewDebtInterest] = useState('');
  const [newDebtMonthly, setNewDebtMonthly] = useState('');
  const [newDebtKind, setNewDebtKind] = useState<'consumer' | 'house'>('consumer');
  const [newDebtPropertyValue, setNewDebtPropertyValue] = useState('');
  const [debtArchiveOpen, setDebtArchiveOpen] = useState(true);
  const [boostHouseDebtsOpen, setBoostHouseDebtsOpen] = useState(true);
  const [boostConsumerDebtsOpen, setBoostConsumerDebtsOpen] = useState(true);
  const [transactions, setTx] = useState<Transaction[]>(() =>
    Array.isArray(_bootCache?.transactions) ? _bootCache.transactions : [],
  );
  const [form, setForm] = useState<FormState>({
    type: 'ausgabe',
    amount: '',
    currency: _bootBaseCurrency,
    category: CATS.ausgaben[0],
    note: '',
    date: todayIsoDate(),
    paymentMethod: '',
    linkedDebtId: '',
    feeStr: '',
    taxStr: '',
  });
  const [toast, setToast] = useState<ToastState>(null);
  const [market, setMarket] = useState<MarketItem[]>(() => mergedWatchlistFromExtras(readWatchlistExtrasFromLocal()));
  const [watchlistExtras, setWatchlistExtras] = useState<WatchlistExtraPersist[]>(() => readWatchlistExtrasFromLocal());
  /** Standardtitel (BTC, …) aus Portfolio Power / Order ausblenden, solange Bestand 0; Live Marktdaten bleiben voll. */
  const [portfolioExcludedBaseSyms, setPortfolioExcludedBaseSyms] = useState<string[]>(() => readPortfolioExcludedBaseFromLocal());
  const [portfolioShares, setPortfolioShares] = useState<Record<string, number>>(() =>
    defaultPortfolioSharesFor(tradableMergedFromExtras(readWatchlistExtrasFromLocal())),
  );
  const tradableMarket = useMemo(() => {
    return market.filter((m) => {
      if (
        BASE_SYM_SET.has(m.sym) &&
        portfolioExcludedBaseSyms.includes(m.sym) &&
        (portfolioShares[m.sym] ?? 0) <= 1e-12
      ) {
        return false;
      }
      if (BASE_SYM_SET.has(m.sym)) return true;
      const ex = watchlistExtras.find((e) => sanitizeWatchlistSymbol(e.sym) === m.sym);
      return !!(ex && ex.watchlistOnly !== true);
    });
  }, [market, watchlistExtras, portfolioExcludedBaseSyms, portfolioShares]);
  const portfolioValue = portfolioEuroValue(portfolioShares, tradableMarket);
  const portfolioAlloc = valueWeightsFromShares(portfolioShares, tradableMarket);
  const [portfolioTrades, setPortfolioTrades] = useState<PortfolioTrade[]>([]);
  /** Bargeld auf dem Brokerkonto, noch nicht in Positionen investiert (manuell, wird mit Profil gespeichert). */
  const [portfolioBrokerCash, setPortfolioBrokerCash] = useState(() =>
    typeof _bootCache?.portfolioBrokerCash === 'number' ? Math.max(0, _bootCache.portfolioBrokerCash) : 0,
  );
  /** Portfolio Power in der UI: investierter Wert + Cash Depot. */
  const portfolioTotalPower = Math.round((portfolioValue + portfolioBrokerCash) * 100) / 100;
  const [levelUpPortfolioOpen, setLevelUpPortfolioOpen] = useState(true);
  const [levelUpMarketOpen, setLevelUpMarketOpen] = useState(true);
  const [marketDetailSym, setMarketDetailSym] = useState<string | null>(null);
  const [marketHistoryLoading, setMarketHistoryLoading] = useState<string | null>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [tradeSym, setTradeSym] = useState(BASE_MARKET[0].sym);
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeFeeStr, setTradeFeeStr] = useState('');
  const [tradeTaxStr, setTradeTaxStr] = useState('');
  const [levelUpTradesOpen, setLevelUpTradesOpen] = useState(true);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeEditAmount, setTradeEditAmount] = useState('');
  const [tradeEditPrice, setTradeEditPrice] = useState('');
  const [tradeEditFeeStr, setTradeEditFeeStr] = useState('');
  const [tradeEditTaxStr, setTradeEditTaxStr] = useState('');
  const [tradeEditDate, setTradeEditDate] = useState('');
  const [wlAddSym, setWlAddSym] = useState('');
  const [wlAddName, setWlAddName] = useState('');
  const [wlAddKind, setWlAddKind] = useState<'stock' | 'crypto'>('stock');
  const [wlAddLoading, setWlAddLoading] = useState(false);
  /** Mini-Formular: neben „Live“ in Live Marktdaten */
  const [liveMarketAddOpen, setLiveMarketAddOpen] = useState(false);
  /** Mini-Formular: aus Order-Dropdown „Neue Aktie / Krypto“ */
  const [orderInstrumentAddOpen, setOrderInstrumentAddOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [sub, setSub] = useState<SubscriptionState>({ tier: 'free', cycle: 'monthly' });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('allwin.token') || '');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [appTourOpen, setAppTourOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [legalSheet, setLegalSheet] = useState<null | 'impressum' | 'rechtlich' | 'disclaimer'>(null);
  const [profileSection, setProfileSection] = useState<
    'overview' | 'subscription' | 'personal' | 'notifications' | 'feedback' | 'redeem' | 'orden'
  >('overview');
  const [feedbackKind, setFeedbackKind] = useState<'bug' | 'improve' | 'feature' | 'other'>('improve');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    suspiciousCharges: true,
    subscriptionChanges: true,
    weeklySummary: true,
  });
  const [earnedOrdenPresetIds, setEarnedOrdenPresetIds] = useState<string[]>(() => readGuestEarnedOrdenPresetIds());
  const [redeemCode, setRedeemCode] = useState('');
  const [isHydrating, setHydrating] = useState(false);
  /** Erst nach erfolgreichem GET /api/user/state — blockiert PUT, bis Cloud-Daten geladen sind (kein Überschreiben von onboarding). */
  const [cloudUserStateReady, setCloudUserStateReady] = useState(false);
  /** Verhindert PUT mit onboarding.done=false bevor GET die Cloud-Daten angewendet hat. */
  const cloudOnboardingHydratedRef = useRef(false);
  /** Verhindert PUT mit leerem State bevor GET erfolgreich geladen wurde (Refresh-Bug). */
  const cloudPersistReadyRef = useRef(false);
  const cloudSavedAtRef = useRef(0);
  const cloudPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPendingCloudPersist = useCallback(() => {
    if (cloudPersistTimerRef.current != null) {
      clearTimeout(cloudPersistTimerRef.current);
      cloudPersistTimerRef.current = null;
    }
  }, []);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authGate, setAuthGate] = useState<'welcome' | 'auth'>('welcome');
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingV2, setOnboardingV2] = useState<OnboardingV2Payload | null>(null);
  const [levelUpMode, setLevelUpMode] = useState<LevelUpMode>(() => {
    const cached = _bootCache?.levelUpMode;
    const bootDebts = _bootCache?.debts ?? [];
    return resolveLevelUpMode({ fromCache: cached, debts: bootDebts });
  });
  const [notgroschenBalance, setNotgroschenBalance] = useState(() =>
    typeof _bootCache?.notgroschenBalance === 'number' ? _bootCache.notgroschenBalance : 0,
  );
  const [notgroschenTarget, setNotgroschenTarget] = useState(() =>
    typeof _bootCache?.notgroschenTarget === 'number' ? _bootCache.notgroschenTarget : 0,
  );
  const [notgroschenHomeMenuOpen, setNotgroschenHomeMenuOpen] = useState(false);
  const [notgroschenHomeEditing, setNotgroschenHomeEditing] = useState(false);
  const [notgroschenHomeDraft, setNotgroschenHomeDraft] = useState('');
  const notgroschenHomeMenuRef = useRef<HTMLDivElement | null>(null);
  const [portfolioCashMenuOpen, setPortfolioCashMenuOpen] = useState(false);
  const [portfolioCashEditing, setPortfolioCashEditing] = useState(false);
  const [portfolioCashDraft, setPortfolioCashDraft] = useState('');
  const portfolioCashMenuRef = useRef<HTMLDivElement | null>(null);
  const [moneyOverflowOpen, setMoneyOverflowOpen] = useState(false);
  const moneyOverflowRef = useRef<HTMLDivElement | null>(null);
  const [wizardRemount, setWizardRemount] = useState(0);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [googleUiReady, setGoogleUiReady] = useState(false);
  const [googleUiFailed, setGoogleUiFailed] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [debtVictoryOpen, setDebtVictoryOpen] = useState(false);
  const prevAllDebtsPaidRef = useRef(false);
  const [notgroschenVictoryOpen, setNotgroschenVictoryOpen] = useState(false);
  const prevNotgroschenGoalMetRef = useRef<boolean | null>(null);
  const [portfolioMilestoneOpen, setPortfolioMilestoneOpen] = useState(false);
  const [portfolioMilestoneKind, setPortfolioMilestoneKind] = useState<PortfolioPowerMilestone>(8000);
  const [celebratedMilestones, setCelebratedMilestones] = useState<Set<PortfolioPowerMilestone>>(() => new Set());
  const prevPortfolioPowerForMilestoneRef = useRef<number | null>(null);
  const [moneyTxListExpanded, setMoneyTxListExpanded] = useState(true);
  const [moneyFormOpen, setMoneyFormOpen] = useState(() => !isMoneyCompactViewport());
  const [receiptScanning, setReceiptScanning] = useState(false);
  const receiptCameraInputRef = useRef<HTMLInputElement>(null);
  const receiptLibraryInputRef = useRef<HTMLInputElement>(null);
  const [moneyIncomeOpen, setMoneyIncomeOpen] = useState(() => !isMoneyCompactViewport());
  const [moneyFixedCostsOpen, setMoneyFixedCostsOpen] = useState(() => !isMoneyCompactViewport());
  const [moneyVarCostsOpen, setMoneyVarCostsOpen] = useState(() => !isMoneyCompactViewport());
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  /** Monats-Gruppen in „Letzte Buchungen“ — nur aktueller Kalendermonat standardmäßig offen. */
  const [moneyTxOpenMonths, setMoneyTxOpenMonths] = useState<Record<string, boolean>>({});
  const vermogenSnapRef = useRef({ notgroschenBalance: 0, portfolioTotalPower: 0, totalDebt: 0, immobilienWert: 0 });
  const [dailyVermogenSnapshots, setDailyVermogenSnapshots] = useState<DailyVermogenSnapshot[]>(() => readGuestDailyVermogenSnapshots());

  const upsertDailyVermogenSnapshot = useCallback(() => {
    const r = vermogenSnapRef.current;
    const today = new Date().toLocaleDateString('sv-SE');
    const ng = Math.round(r.notgroschenBalance * 100) / 100;
    const port = Math.round(r.portfolioTotalPower * 100) / 100;
    const schulden = Math.round(Math.max(0, r.totalDebt) * 100) / 100;
    const immobilienWert = Math.round(Math.max(0, r.immobilienWert) * 100) / 100;
    const saldoKomplett = Math.round((ng + port + immobilienWert - schulden) * 100) / 100;
    const row: DailyVermogenSnapshot = { date: today, notgroschen: ng, portfolioPlusCash: port, immobilienWert, schulden, saldoKomplett };
    setDailyVermogenSnapshots((prev) => {
      const old = prev.find((p) => p.date === row.date);
      if (
        old &&
        Math.abs(old.notgroschen - row.notgroschen) < 0.51 &&
        Math.abs(old.portfolioPlusCash - row.portfolioPlusCash) < 0.51 &&
        Math.abs(old.schulden - row.schulden) < 0.51 &&
        Math.abs((old.immobilienWert ?? 0) - (row.immobilienWert ?? 0)) < 0.51 &&
        Math.abs(old.saldoKomplett - row.saldoKomplett) < 0.51
      ) {
        return prev;
      }
      const next = [...prev.filter((p) => p.date !== row.date), row].sort((a, b) => a.date.localeCompare(b.date));
      return next.slice(-MAX_DAILY_VERMOGEN_SNAPSHOTS);
    });
  }, []);

  /** Sofort vor dem ersten Paint: verhindert PUT mit lokalem onboarding=false und Wizard-Flash vor GET /api/user/state. */
  useLayoutEffect(() => {
    if (!authUser || !authToken) {
      setHydrating(false);
      setCloudUserStateReady(false);
      cloudOnboardingHydratedRef.current = false;
      cloudPersistReadyRef.current = false;
      return;
    }
    setHydrating(true);
    setCloudUserStateReady(false);
    cloudOnboardingHydratedRef.current = false;
    cloudPersistReadyRef.current = false;
    setOnboardingDone(readLocalOnboardingDone(authUser.id, authUser.email));
    const cached = readUserStateCache(authUser.id);
    if (cached) {
      flushSync(() => {
        if (Array.isArray(cached.transactions)) setTx(cached.transactions);
        if (Array.isArray(cached.debts)) {
          setDebts(cached.debts.map((d) => ({ ...d, kind: d.kind === 'house' ? 'house' : 'consumer' })));
        }
        if (typeof cached.notgroschenBalance === 'number' && !Number.isNaN(cached.notgroschenBalance)) {
          setNotgroschenBalance(cached.notgroschenBalance);
        }
        if (typeof cached.notgroschenTarget === 'number' && !Number.isNaN(cached.notgroschenTarget)) {
          setNotgroschenTarget(cached.notgroschenTarget);
        }
        if (typeof cached.portfolioBrokerCash === 'number' && !Number.isNaN(cached.portfolioBrokerCash)) {
          setPortfolioBrokerCash(Math.max(0, cached.portfolioBrokerCash));
        }
        if (cached.levelUpMode) {
          setLevelUpMode(resolveLevelUpMode({ fromCache: cached.levelUpMode, debts: cached.debts ?? [] }));
        }
        if (cached.baseCurrency) {
          const bc = normalizeBaseCurrency(cached.baseCurrency);
          setBaseCurrency(bc);
        }
      });
    }
  }, [authUser?.id, authUser?.email, authToken]);

  /** Bestehende Nutzer: Hauskredit-only + alter Modus until_emergency_half → LevelUp frei. */
  useEffect(() => {
    if (!onboardingV2) return;
    const resolved = resolveLevelUpMode({
      fromV2: onboardingV2.levelUpMode,
      debts,
      debtKinds: onboardingV2.debtKinds,
    });
    setLevelUpMode((cur) => (cur === resolved ? cur : resolved));
  }, [onboardingV2, debts]);

  const chartTimelineEndMs = useMemo(
    () => inferChartTimelineEndMs(transactions, portfolioTrades, dailyVermogenSnapshots),
    [transactions, portfolioTrades, dailyVermogenSnapshots],
  );
  const reportYear = useMemo(() => new Date(chartTimelineEndMs).getFullYear(), [chartTimelineEndMs]);
  const calMonth0 = new Date().getMonth();
  const monthlyBuckets = useMemo(
    () => aggregateByCalendarMonth(transactions, reportYear),
    [transactions, reportYear],
  );
  const moneyThisMonth = monthlyBuckets[calMonth0] ?? { einnahmen: 0, ausgaben: 0 };
  const saldo = moneyThisMonth.einnahmen - moneyThisMonth.ausgaben;
  const fixedCostOverviewRows = useMemo(() => latestFixedCostRows(transactions), [transactions]);
  const fixedCostOverviewSum = useMemo(
    () =>
      fixedCostOverviewRows.reduce((s, t) => {
        const n = Math.abs(parseFloat(String(t.amount).replace(',', '.')));
        return s + (Number.isNaN(n) ? 0 : n);
      }, 0),
    [fixedCostOverviewRows],
  );
  const variableCostOverviewRows = useMemo(() => latestVarCostRows(transactions), [transactions]);
  const incomeOverviewRows = useMemo(() => aggregatedIncomeRows(transactions), [transactions]);

  const moneyTxMonthGroups = useMemo(() => {
    const bucket = new Map<string, { year: number; month0: number; txs: Transaction[] }>();
    for (const tx of transactions) {
      const p = parseTxDateParts(tx.date);
      if (!p) continue;
      const key = moneyTxMonthKey(p.year, p.month0);
      if (!bucket.has(key)) bucket.set(key, { year: p.year, month0: p.month0, txs: [] });
      bucket.get(key)!.txs.push(tx);
    }
    return Array.from(bucket.values())
      .map((g) => ({ ...g, txs: [...g.txs].sort(compareTxByDateDesc) }))
      .sort((a, b) => b.year * 12 + b.month0 - (a.year * 12 + a.month0));
  }, [transactions]);

  useEffect(() => {
    if (moneyTxMonthGroups.length === 0) return;
    setMoneyTxOpenMonths((prev) => {
      const next = { ...prev };
      let changed = false;
      moneyTxMonthGroups.forEach((g, i) => {
        const key = moneyTxMonthKey(g.year, g.month0);
        if (!(key in next)) {
          next[key] = i === 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [moneyTxMonthGroups]);
  const variableCostOverviewSum = useMemo(
    () =>
      variableCostOverviewRows.reduce((s, t) => {
        const n = Math.abs(parseFloat(String(t.amount).replace(',', '.')));
        return s + (Number.isNaN(n) ? 0 : n);
      }, 0),
    [variableCostOverviewRows],
  );
  const incomeOverviewSum = useMemo(
    () => Math.round(allIncomeTransactions(transactions).reduce((s, t) => s + parseIncomeAmount(t.amount), 0) * 100) / 100,
    [transactions],
  );
  const noteSuggestions = useMemo(
    () =>
      noteAutocompleteSuggestions(
        transactions,
        form.type,
        form.category,
        form.note,
      ),
    [transactions, form.type, form.category, form.note],
  );
  const [fxBasePerUnit, setFxBasePerUnit] = useState<number>(1);
  const [fxRateDate, setFxRateDate] = useState('');
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState('');
  useEffect(() => {
    if (form.currency === baseCurrency) {
      setFxBasePerUnit(1);
      setFxRateDate('');
      setFxError('');
      setFxLoading(false);
      return;
    }
    let cancelled = false;
    setFxLoading(true);
    setFxError('');
    void fetchFxRate(form.currency, baseCurrency, BILLING_API)
      .then((q) => {
        if (cancelled) return;
        setFxBasePerUnit(q.basePerUnit);
        setFxRateDate(q.date);
      })
      .catch(() => {
        if (!cancelled) {
          setFxError('Wechselkurs gerade nicht verfügbar.');
          setFxBasePerUnit(NaN);
        }
      })
      .finally(() => {
        if (!cancelled) setFxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.currency, baseCurrency, BILLING_API]);
  const convertedBasePreview = useMemo(() => {
    if (form.currency === baseCurrency) return null;
    const raw = parseFloat(String(form.amount).replace(/\s/g, '').replace(',', '.'));
    if (Number.isNaN(raw) || raw <= 0 || !Number.isFinite(fxBasePerUnit) || fxBasePerUnit <= 0) return null;
    return convertForeignToBase(raw, fxBasePerUnit);
  }, [form.amount, form.currency, baseCurrency, fxBasePerUnit]);
  const chartFixedPie = useMemo(
    () =>
      fixedCostOverviewRows
        .map((tx) => ({
          name: `${formatFixedCostTitle(tx)} (${fixedCostKindShort(tx.category)})`,
          value: Math.abs(parseFloat(String(tx.amount).replace(/\s/g, '').replace(',', '.'))) || 0,
        }))
        .filter((x) => x.value > 0),
    [fixedCostOverviewRows],
  );
  const chartVarPie = useMemo(
    () =>
      variableCostOverviewRows
        .map((tx) => ({
          name: `${tx.category}: ${formatVarCostTitle(tx)}`,
          value: Math.abs(parseFloat(String(tx.amount).replace(/\s/g, '').replace(',', '.'))) || 0,
        }))
        .filter((x) => x.value > 0),
    [variableCostOverviewRows],
  );
  const chartIncomePie = useMemo(() => incomePieSlicesFromRows(allIncomeTransactions(transactions)), [transactions]);
  const chartMarketPrices = useMemo(() => {
    const r: Record<string, number> = {};
    for (const m of market) r[m.sym] = m.price;
    return r;
  }, [market]);
  const totalDebt = debts.reduce((s, d) => s + d.remaining, 0);
  const housePropertyValueTotal = useMemo(
    () =>
      debts
        .filter((d) => d.kind === 'house' && d.remaining > 0)
        .reduce((s, d) => s + debtPropertyValue(d), 0),
    [debts],
  );
  const houseEquityTotal = useMemo(
    () =>
      debts
        .filter((d) => d.kind === 'house' && d.remaining > 0)
        .reduce((s, d) => {
          const eq = debtEquity(d);
          return eq != null ? s + eq : s;
        }, 0),
    [debts],
  );
  vermogenSnapRef.current = {
    notgroschenBalance,
    portfolioTotalPower,
    totalDebt,
    immobilienWert: housePropertyValueTotal,
  };
  const subEffective: SubscriptionState = DEV_FORCE_ELITE ? { ...sub, tier: 'elite' } : sub;
  const isPaidPlan = subEffective.tier !== 'free';

  const levelUpLocked = useMemo(() => {
    if (authUser && authToken && !cloudUserStateReady) return true;
    if (levelUpMode === 'full') return false;
    if (levelUpMode === 'until_all_debts') {
      return debts.some((d) => d.remaining > 0);
    }
    if (levelUpMode === 'until_emergency_half') {
      const t = Math.max(notgroschenTarget, 1);
      return notgroschenBalance < t * 0.5;
    }
    return false;
  }, [authUser, authToken, cloudUserStateReady, levelUpMode, debts, notgroschenBalance, notgroschenTarget]);

  useEffect(() => {
    if (authUser?.id) setCelebratedMilestones(readCelebratedPortfolioMilestones(authUser.id));
  }, [authUser?.id]);

  useEffect(() => {
    if (appTourOpen) return;
    const allPaid = debts.length > 0 && debts.every((d) => d.remaining <= 0);
    if (allPaid && !prevAllDebtsPaidRef.current) {
      setDebtVictoryOpen(true);
    }
    prevAllDebtsPaidRef.current = allPaid;
  }, [debts, appTourOpen]);

  useEffect(() => {
    const next = `#${tabToDisplayHash(tab)}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [tab]);

  useEffect(() => {
    const onHashChange = () => {
      const t = parseAllwinTabHash();
      if (t) setTab(t);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (appTourOpen) return;
    const t = notgroschenTarget;
    const met = t > 0 && notgroschenBalance >= t;
    if (prevNotgroschenGoalMetRef.current === null) {
      prevNotgroschenGoalMetRef.current = met;
      return;
    }
    if (met && !prevNotgroschenGoalMetRef.current) {
      setNotgroschenVictoryOpen(true);
    }
    prevNotgroschenGoalMetRef.current = met;
  }, [notgroschenBalance, notgroschenTarget, appTourOpen]);

  useEffect(() => {
    if (appTourOpen || portfolioMilestoneOpen) return;
    const p = portfolioTotalPower;
    const prev = prevPortfolioPowerForMilestoneRef.current;
    if (prev === null) {
      prevPortfolioPowerForMilestoneRef.current = p;
      return;
    }
    const crossed = highestPortfolioMilestoneCrossed(prev, p);
    if (crossed !== null && !celebratedMilestones.has(crossed)) {
      setPortfolioMilestoneKind(crossed);
      setPortfolioMilestoneOpen(true);
    }
    prevPortfolioPowerForMilestoneRef.current = p;
  }, [portfolioTotalPower, appTourOpen, portfolioMilestoneOpen, celebratedMilestones]);

  const dismissPortfolioMilestone = useCallback(() => {
    setPortfolioMilestoneOpen(false);
    setCelebratedMilestones((prev) => {
      const next = new Set<PortfolioPowerMilestone>(prev);
      next.add(portfolioMilestoneKind);
      writeCelebratedPortfolioMilestones(authUser?.id, next);
      return next;
    });
  }, [authUser?.id, portfolioMilestoneKind]);

  /** Orden: feste Liste — automatisch aus Boost / Notgroschen / Portfolio-Power ergänzt. */
  useEffect(() => {
    setEarnedOrdenPresetIds((prev) => {
      const next = new Set<string>(prev);
      const allPaid = debts.length > 0 && debts.every((d) => d.remaining <= 0);
      if (allPaid) next.add('boost-schulden-frei');
      if (notgroschenTarget > 0 && notgroschenBalance >= notgroschenTarget) {
        next.add('notgroschen-voll');
      }
      for (const m of PORTFOLIO_POWER_MILESTONE_EURS) {
        if (portfolioTotalPower >= m) next.add(portfolioEurToOrdenPresetId(m));
      }
      const sanitized = sanitizeEarnedOrdenIds(next);
      if (sanitized.length === prev.length && sanitized.every((x, i) => x === prev[i])) return prev;
      return sanitized;
    });
  }, [debts, notgroschenTarget, notgroschenBalance, portfolioTotalPower]);

  useEffect(() => {
    if (authUser && authToken && !cloudUserStateReady) return;
    upsertDailyVermogenSnapshot();
  }, [
    authUser,
    authToken,
    cloudUserStateReady,
    notgroschenBalance,
    portfolioBrokerCash,
    portfolioShares,
    portfolioTrades,
    debts,
    upsertDailyVermogenSnapshot,
  ]);

  useEffect(() => {
    const id = window.setInterval(() => {
      upsertDailyVermogenSnapshot();
    }, 180_000);
    return () => clearInterval(id);
  }, [upsertDailyVermogenSnapshot]);

  useEffect(() => {
    if (authUser) return;
    try {
      localStorage.setItem('allwin.dailyVermogenSnapshots', JSON.stringify(dailyVermogenSnapshots));
    } catch {
      /* ignore */
    }
  }, [authUser, dailyVermogenSnapshots]);

  useEffect(() => {
    const key = `${reportYear}-${String(calMonth0 + 1).padStart(2, '0')}`;
    const prev = localStorage.getItem('allwin.moneyTxListMonth');
    if (prev == null) {
      localStorage.setItem('allwin.moneyTxListMonth', key);
      return;
    }
    if (prev !== key) {
      setMoneyTxListExpanded(false);
      localStorage.setItem('allwin.moneyTxListMonth', key);
    }
  }, [reportYear, calMonth0]);

  useEffect(() => {
    if (!notgroschenHomeMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (notgroschenHomeMenuRef.current && !notgroschenHomeMenuRef.current.contains(e.target as Node)) {
        setNotgroschenHomeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [notgroschenHomeMenuOpen]);

  useEffect(() => {
    if (!portfolioCashMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (portfolioCashMenuRef.current && !portfolioCashMenuRef.current.contains(e.target as Node)) {
        setPortfolioCashMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [portfolioCashMenuOpen]);

  useEffect(() => {
    if (!moneyOverflowOpen) return;
    const close = (e: MouseEvent) => {
      if (moneyOverflowRef.current && !moneyOverflowRef.current.contains(e.target as Node)) {
        setMoneyOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moneyOverflowOpen]);

  useEffect(() => {
    if (authToken) localStorage.setItem('allwin.token', authToken);
    else localStorage.removeItem('allwin.token');
  }, [authToken]);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (ref) localStorage.setItem('allwin.affiliate', ref);
  }, []);

  useEffect(() => {
    setProfileNameDraft(authUser?.name || '');
  }, [authUser]);

  useEffect(() => {
    const restoreSession = async () => {
      if (!authToken) {
        setAuthLoading(false);
        return;
      }
      if (authUser) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await fetch(`${BILLING_API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 401) {
          setAuthToken('');
          setAuthUser(null);
          setAuthLoading(false);
          return;
        }
        if (!res.ok) throw new Error('session-check-failed');
        const data = await res.json();
        setAuthUser(data.user);
      } catch {
        // Keep current token/user on transient network/CORS errors.
        // Otherwise users get kicked out right after social login.
      } finally {
        setAuthLoading(false);
      }
    };
    void restoreSession();
  }, [BILLING_API, authToken, authUser]);

  useEffect(() => {
    const loadUserState = async () => {
      if (!authUser || !authToken) return;
      setHydrating(true);
      try {
        const res = await fetch(`${BILLING_API}/api/user/state`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          showToast('Cloud-Daten konnten nicht geladen werden. Bitte neu anmelden.', 'error');
          const doneOffline = readLocalOnboardingDone(authUser.id, authUser.email);
          flushSync(() => {
            if (doneOffline) setOnboardingDone(true);
          });
          cloudOnboardingHydratedRef.current = true;
          cloudPersistReadyRef.current = false;
          setCloudUserStateReady(true);
          return;
        }
        const data = await res.json();
        const state = data?.state || {};
        const cached = readUserStateCache(authUser.id);
        const cloudTx = Array.isArray(state.transactions) ? (state.transactions as Transaction[]) : [];
        const cachedTx = Array.isArray(cached?.transactions) ? cached.transactions : transactions;
        const cloudSavedAt = Number((state as { _clientSavedAt?: unknown })._clientSavedAt) || 0;
        const cacheSavedAt = typeof cached?.savedAt === 'number' ? cached.savedAt : 0;
        /** Leere Cloud-Liste darf lokalen Cache nicht überschreiben (Reload / Race nach Speichern). */
        const cloudTxList =
          cloudTx.length === 0 && cachedTx.length > 0 && (cloudSavedAt === 0 || cacheSavedAt >= cloudSavedAt)
            ? []
            : Array.isArray(state.transactions)
              ? transactionsFromCloud(cloudTx)
              : [];
        const transactionsToApply = mergeTransactionsById(cloudTxList, cachedTx, authUser.id);
        cloudSavedAtRef.current = Math.max(cloudSavedAt, cacheSavedAt, Date.now());
        const cloudDebts = Array.isArray(state.debts) ? (state.debts as Debt[]) : [];
        const cachedDebts = Array.isArray(cached?.debts) ? cached.debts : debts;
        const cloudDebtList =
          cloudDebts.length === 0 && cachedDebts.length > 0 && (cloudSavedAt === 0 || cacheSavedAt >= cloudSavedAt)
            ? []
            : Array.isArray(state.debts)
              ? debtsFromCloud(cloudDebts)
              : [];
        const debtsToApply = mergeDebtsById(cloudDebtList, cachedDebts);
        let ngBal = notgroschenBalance;
        let ngTarget = notgroschenTarget;
        let brokerCash = portfolioBrokerCash;
        if (state.subscription?.tier && state.subscription?.cycle) setSub(state.subscription);
        if (state.notifications) setNotifSettings(state.notifications);
        const ob = state.onboarding;
        const v2 = ob?.v2 && typeof ob.v2 === 'object' ? (ob.v2 as OnboardingV2Payload) : null;
        const serverMode = (state as { levelUpMode?: unknown }).levelUpMode;
        const resolvedMode = resolveLevelUpMode({
          fromV2: v2?.levelUpMode,
          fromServer: serverMode as LevelUpMode | null,
          fromCache: cached?.levelUpMode,
          debts: debtsToApply,
          debtKinds: v2?.debtKinds,
        });
        const done = resolveOnboardingDoneFromCloud(ob, authUser.id, authUser.email, state);
        const hasV2 = ob?.v2 != null && typeof ob.v2 === 'object';
        const obDoneFlag = ob?.done === true || ob?.done === 'true' || ob?.done === 1;
        flushSync(() => {
          setOnboardingDone(done);
        });
        if (done) writeLocalOnboardingDone(authUser.id, authUser.email);
        if (done && !obDoneFlag && authToken) {
          void fetch(`${BILLING_API}/api/user/state`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              state: { onboarding: { done: true, ...(hasV2 ? { v2: ob.v2 } : {}) } },
            }),
          });
        }
        const ng = state.notgroschen;
        if (ng && typeof ng === 'object') {
          const b = (ng as { balance?: unknown }).balance;
          const t = (ng as { target?: unknown }).target;
          if (typeof b === 'number' && !Number.isNaN(b)) ngBal = b;
          if (typeof t === 'number' && !Number.isNaN(t)) ngTarget = t;
        } else if (ob?.v2 && typeof ob.v2 === 'object') {
          const v2 = ob.v2 as OnboardingV2Payload;
          ngTarget = notgroschenTargetFromIncome(v2.netIncomeMonthly);
          if (v2.emergency?.has) ngBal = Math.max(0, v2.emergency.balance);
        } else if (cached) {
          if (typeof cached.notgroschenBalance === 'number') ngBal = cached.notgroschenBalance;
          if (typeof cached.notgroschenTarget === 'number') ngTarget = cached.notgroschenTarget;
        }
        const pbcCloud = (state as { portfolioBrokerCash?: unknown }).portfolioBrokerCash;
        if (typeof pbcCloud === 'number' && !Number.isNaN(pbcCloud)) {
          brokerCash = Math.max(0, pbcCloud);
        } else if (typeof cached?.portfolioBrokerCash === 'number') {
          brokerCash = Math.max(0, cached.portfolioBrokerCash);
        }
        const cloudExtras = normalizeWatchlistExtrasPersist((state as { watchlistExtras?: unknown }).watchlistExtras);
        setWatchlistExtras(cloudExtras);
        try {
          localStorage.setItem('allwin.watchlistExtras', JSON.stringify(cloudExtras));
        } catch {
          /* ignore */
        }
        const excludedFromCloud = normalizePortfolioExcludedBaseSyms(
          (state as { portfolioExcludedBaseSyms?: unknown }).portfolioExcludedBaseSyms,
        );
        setPortfolioExcludedBaseSyms(excludedFromCloud);
        try {
          localStorage.setItem('allwin.portfolioExcludedBaseSyms', JSON.stringify(excludedFromCloud));
        } catch {
          /* ignore */
        }
        const mergedWl = mergedWatchlistFromExtras(cloudExtras);
        setMarket(mergedWl);
        const tradableWl = tradableMergedFromExtras(cloudExtras);
        const symSetTradable = new Set(tradableWl.map((m) => m.sym));

        if (state.portfolioShares && typeof state.portfolioShares === 'object') {
          setPortfolioShares(normalizePortfolioShares(state.portfolioShares, tradableWl));
        } else if (typeof state.portfolio === 'number') {
          const alloc = state.portfolioAlloc
            ? normalizePortfolioAlloc(state.portfolioAlloc, tradableWl)
            : defaultPortfolioAllocFor(tradableWl);
          setPortfolioShares(sharesFromLegacyEuro(state.portfolio, alloc, tradableWl));
        }
        if (Array.isArray(state.portfolioTrades)) {
          setPortfolioTrades(normalizePortfolioTrades(state.portfolioTrades, symSetTradable));
        }
        const dailyVs = (state as { dailyVermogenSnapshots?: unknown }).dailyVermogenSnapshots;
        const dailySnaps = normalizeDailyVermogenSnapshots(dailyVs);
        const prof = state.profile;
        let genderLoad = '';
        let ordenLoad: string[] = [];
        if (prof && typeof prof === 'object') {
          const g = (prof as { gender?: unknown }).gender;
          genderLoad = typeof g === 'string' ? g : '';
          const pr = prof as { ordenEarnedPresetIds?: unknown; manualOrden?: unknown };
          ordenLoad = normalizeEarnedOrdenOnLoad(pr.ordenEarnedPresetIds, pr.manualOrden);
        }
        const loadedBaseCurrency = normalizeBaseCurrency(
          (state as { baseCurrency?: unknown }).baseCurrency ?? cached?.baseCurrency,
        );
        flushSync(() => {
          setOnboardingV2(v2);
          setLevelUpMode(resolvedMode);
          setBaseCurrency(loadedBaseCurrency);
          setDebts(
            debtsToApply.map((d) => ({
              ...d,
              kind: d.kind === 'house' ? 'house' : 'consumer',
            })),
          );
          setTx(transactionsToApply);
          setNotgroschenBalance(ngBal);
          setNotgroschenTarget(ngTarget);
          setPortfolioBrokerCash(brokerCash);
          setDailyVermogenSnapshots(dailySnaps);
          setProfileGender(genderLoad);
          setEarnedOrdenPresetIds(ordenLoad);
        });
        writeUserStateCache(authUser.id, {
          transactions: transactionsToApply,
          debts: debtsToApply,
          notgroschenBalance: ngBal,
          notgroschenTarget: ngTarget,
          portfolioBrokerCash: brokerCash,
          levelUpMode: resolvedMode,
          baseCurrency: loadedBaseCurrency,
        });
        const recoveredFromCache =
          cachedTx.length > cloudTx.length ||
          (cloudTx.length === 0 && transactionsToApply.length > 0);
        cloudOnboardingHydratedRef.current = true;
        window.setTimeout(() => {
          cloudPersistReadyRef.current = true;
          setCloudUserStateReady(true);
          if (recoveredFromCache && transactionsToApply.length > 0) {
            void persistUserState(
              {
                transactions: transactionsToApply,
                debts: debtsToApply,
                notgroschenBalance: ngBal,
                notgroschenTarget: ngTarget,
                portfolioBrokerCash: brokerCash,
              },
              { replaceTransactions: true, replaceDebts: true },
            );
          }
        }, 0);
      } finally {
        setHydrating(false);
      }
    };
    void loadUserState();
  }, [BILLING_API, authToken, authUser?.id]);

  const persistUserState = useCallback(
    (
      override?: UserStateCache,
      options?: { replaceTransactions?: boolean; replaceDebts?: boolean; background?: boolean; retry?: boolean },
    ) => {
      if (!authToken || !authUser?.id || !BILLING_API) return Promise.resolve(false);
      const txList = override?.transactions ?? transactions;
      const debtList = override?.debts ?? debts;
      const ngB = override?.notgroschenBalance ?? notgroschenBalance;
      const ngT = override?.notgroschenTarget ?? notgroschenTarget;
      const broker = override?.portfolioBrokerCash ?? portfolioBrokerCash;
      const baseCur = normalizeBaseCurrency(override?.baseCurrency ?? baseCurrency);
      writeUserStateCache(authUser.id, {
        transactions: txList,
        debts: debtList,
        notgroschenBalance: ngB,
        notgroschenTarget: ngT,
        portfolioBrokerCash: broker,
        levelUpMode,
        baseCurrency: baseCur,
      });
      const hasMoneyData = txList.length > 0 || debtList.length > 0;
      if (!cloudPersistReadyRef.current && !hasMoneyData && !options?.replaceTransactions && !options?.replaceDebts) {
        return Promise.resolve(false);
      }
      const statePayload: Record<string, unknown> = {
        subscription: sub,
        profile: { gender: profileGender, ordenEarnedPresetIds: earnedOrdenPresetIds },
        notgroschen: { balance: ngB, target: ngT },
        notifications: notifSettings,
        portfolio: +portfolioEuroValue(portfolioShares, tradableMarket).toFixed(2),
        portfolioAlloc: valueWeightsFromShares(portfolioShares, tradableMarket),
        portfolioShares,
        portfolioTrades,
        portfolioBrokerCash: broker,
        watchlistExtras,
        portfolioExcludedBaseSyms,
        dailyVermogenSnapshots,
        baseCurrency: baseCur,
      };
      const canCloudPersist = cloudPersistReadyRef.current;
      const clientSavedAt = Date.now();
      if (canCloudPersist) {
        if (txList.length > 0 || options?.replaceTransactions) {
          statePayload.transactions = txList;
          statePayload._replaceTransactions = true;
        }
        if (debtList.length > 0 || options?.replaceDebts) {
          statePayload.debts = debtList;
          statePayload._replaceDebts = true;
        }
        statePayload._clientSavedAt = clientSavedAt;
      } else {
        if (debtList.length > 0 || options?.replaceDebts) statePayload.debts = debtList;
        if (txList.length > 0 || options?.replaceTransactions) statePayload.transactions = txList;
        if (options?.replaceTransactions) statePayload._replaceTransactions = true;
        if (options?.replaceDebts) statePayload._replaceDebts = true;
        if (options?.replaceTransactions || options?.replaceDebts || txList.length > 0 || debtList.length > 0) {
          statePayload._clientSavedAt = clientSavedAt;
        }
      }
      statePayload.levelUpMode = levelUpMode;
      if (cloudOnboardingHydratedRef.current) {
        const persistDone =
          onboardingDone ||
          readLocalOnboardingDone(authUser.id, authUser.email) ||
          (onboardingV2 != null && typeof onboardingV2 === 'object');
        const onboardingPayload: { done: boolean; v2?: OnboardingV2Payload } = { done: persistDone };
        if (onboardingV2 != null) onboardingPayload.v2 = onboardingV2;
        statePayload.onboarding = onboardingPayload;
      }
      const requestInit: RequestInit = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ state: statePayload }),
        // iOS Safari/PWA: erlaubt Versand beim Hintergrundwechsel/Tab-Schließen.
        keepalive: options?.background === true,
      };
      return fetch(`${BILLING_API}/api/user/state`, requestInit)
        .then(async (res) => {
          if (!res.ok) {
            if (import.meta.env.DEV) console.warn('[cloud] PUT /api/user/state', res.status);
            return false;
          }
          try {
            const body = await res.json();
            if (typeof body?.clientSavedAt === 'number' && !Number.isNaN(body.clientSavedAt)) {
              cloudSavedAtRef.current = body.clientSavedAt;
            }
          } catch {
            /* ignore */
          }
          return true;
        })
        .catch(async () => {
          // Einmaliger Retry bei kurzfristigen Mobilfunk-/WLAN-Aussetzern.
          if (options?.retry !== false && navigator.onLine) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 350));
              const retryRes = await fetch(`${BILLING_API}/api/user/state`, requestInit);
              if (!retryRes.ok) return false;
              const body = await retryRes.json().catch(() => null);
              if (typeof body?.clientSavedAt === 'number' && !Number.isNaN(body.clientSavedAt)) {
                cloudSavedAtRef.current = body.clientSavedAt;
              }
              return true;
            } catch {
              /* ignore retry error */
            }
          }
          /* Cloud-Sync fehlgeschlagen — lokaler Cache bleibt die Quelle */
          return false;
        });
    },
    [
      BILLING_API,
      authToken,
      authUser,
      transactions,
      debts,
      sub,
      profileGender,
      earnedOrdenPresetIds,
      notgroschenBalance,
      notgroschenTarget,
      notifSettings,
      tradableMarket,
      portfolioShares,
      portfolioTrades,
      portfolioBrokerCash,
      watchlistExtras,
      portfolioExcludedBaseSyms,
      dailyVermogenSnapshots,
      onboardingDone,
      onboardingV2,
      levelUpMode,
      baseCurrency,
    ],
  );

  const applyBaseCurrency = useCallback(
    (code: string) => {
      const next = normalizeBaseCurrency(code);
      setBaseCurrency(next);
      setForm((f) => (editingTxId == null ? { ...f, currency: next } : f));
      if (authUser?.id) {
        writeUserStateCache(authUser.id, { baseCurrency: next });
        void persistUserState({ baseCurrency: next }, { background: true });
      }
    },
    [authUser?.id, editingTxId, persistUserState],
  );

  useEffect(() => {
    if (moneyFormOpen && editingTxId == null) {
      setForm((f) => (f.currency === baseCurrency ? f : { ...f, currency: baseCurrency }));
    }
  }, [moneyFormOpen, editingTxId, baseCurrency]);

  useEffect(() => {
    if (!authUser?.id) return;
    writeUserStateCache(authUser.id, {
      transactions,
      debts,
      notgroschenBalance,
      notgroschenTarget,
      portfolioBrokerCash,
      levelUpMode,
      baseCurrency,
    });
  }, [authUser?.id, transactions, debts, notgroschenBalance, notgroschenTarget, portfolioBrokerCash, levelUpMode, baseCurrency]);

  useEffect(() => {
    if (!authToken || !authUser?.id) return;
    const flushToCloud = () => persistUserState(undefined, { background: true });
    const onVisHide = () => {
      if (document.visibilityState === 'hidden') flushToCloud();
    };
    window.addEventListener('pagehide', flushToCloud);
    document.addEventListener('visibilitychange', onVisHide);
    return () => {
      window.removeEventListener('pagehide', flushToCloud);
      document.removeEventListener('visibilitychange', onVisHide);
    };
  }, [authToken, authUser?.id, persistUserState]);

  useEffect(() => {
    if (!authToken || !authUser?.id || !BILLING_API) return;
    const sendPing = () => {
      void fetch(`${BILLING_API}/api/analytics/ping`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tab }),
        keepalive: true,
      }).catch(() => {});
    };
    sendPing();
    const id = window.setInterval(sendPing, 60_000);
    return () => window.clearInterval(id);
  }, [BILLING_API, authToken, authUser?.id, tab]);

  useEffect(() => {
    if (!authToken || !authUser?.id || !cloudPersistReadyRef.current) return;
    const onOnline = () => {
      clearPendingCloudPersist();
      void persistUserState(undefined, { retry: false });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [authToken, authUser?.id, persistUserState, clearPendingCloudPersist]);

  useEffect(() => {
    if (!authUser || !authToken || isHydrating || !cloudUserStateReady || !cloudPersistReadyRef.current) return;
    clearPendingCloudPersist();
    cloudPersistTimerRef.current = setTimeout(() => {
      cloudPersistTimerRef.current = null;
      void persistUserState();
    }, 500);
    return () => clearPendingCloudPersist();
  }, [
    clearPendingCloudPersist,
    persistUserState,
    BILLING_API,
    authToken,
    authUser,
    cloudUserStateReady,
    debts,
    isHydrating,
    tradableMarket,
    notgroschenBalance,
    notgroschenTarget,
    notifSettings,
    onboardingDone,
    onboardingV2,
    portfolioBrokerCash,
    portfolioShares,
    portfolioTrades,
    profileGender,
    earnedOrdenPresetIds,
    sub,
    transactions,
    watchlistExtras,
    portfolioExcludedBaseSyms,
    dailyVermogenSnapshots,
  ]);

  /** Anderes Gerät (z. B. iPhone) → beim Zurückkehren Cloud neu laden. */
  useEffect(() => {
    if (!authUser?.id || !authToken || !BILLING_API || !cloudUserStateReady) return;
    let pulling = false;
    const pullMoneyFromCloud = async () => {
      if (pulling || document.visibilityState !== 'visible') return;
      pulling = true;
      try {
        const res = await fetch(`${BILLING_API}/api/user/state`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const state = (await res.json())?.state || {};
        const cloudSavedAt = Number((state as { _clientSavedAt?: unknown })._clientSavedAt) || 0;
        const cached = readUserStateCache(authUser.id);
        const cacheSavedAt = typeof cached?.savedAt === 'number' ? cached.savedAt : 0;
        /** Lokale Änderungen nicht mit älterem Cloud-Stand überschreiben (z. B. nach Speichern / Tab-Wechsel). */
        if (cloudSavedAt < cacheSavedAt) return;
        if (cloudSavedAt > 0 && cloudSavedAt <= cloudSavedAtRef.current && cacheSavedAt <= cloudSavedAtRef.current) {
          return;
        }
        const cloudTx = Array.isArray(state.transactions) ? (state.transactions as Transaction[]) : [];
        const cloudDebts = Array.isArray(state.debts) ? (state.debts as Debt[]) : [];
        const cachedTx = Array.isArray(cached?.transactions) ? cached.transactions : [];
        const cachedDebts = Array.isArray(cached?.debts) ? cached.debts : [];
        const mergedTx = mergeTransactionsById(transactionsFromCloud(cloudTx), cachedTx, authUser.id);
        cloudSavedAtRef.current = Math.max(cloudSavedAtRef.current, cloudSavedAt, Date.now());
        const mergedDebts = mergeDebtsById(debtsFromCloud(cloudDebts), cachedDebts);
        flushSync(() => {
          setTx(mergedTx);
          setDebts(mergedDebts);
        });
        const ng = state.notgroschen;
        let ngB = notgroschenBalance;
        let ngT = notgroschenTarget;
        if (ng && typeof ng === 'object') {
          const b = (ng as { balance?: unknown }).balance;
          const t = (ng as { target?: unknown }).target;
          if (typeof b === 'number' && !Number.isNaN(b)) ngB = b;
          if (typeof t === 'number' && !Number.isNaN(t)) ngT = t;
        }
        const pbc = (state as { portfolioBrokerCash?: unknown }).portfolioBrokerCash;
        const broker =
          typeof pbc === 'number' && !Number.isNaN(pbc)
            ? Math.max(0, pbc)
            : typeof cached?.portfolioBrokerCash === 'number'
              ? cached.portfolioBrokerCash
              : portfolioBrokerCash;
        setNotgroschenBalance(ngB);
        setNotgroschenTarget(ngT);
        setPortfolioBrokerCash(broker);
        writeUserStateCache(authUser.id, {
          transactions: mergedTx,
          debts: mergedDebts,
          notgroschenBalance: ngB,
          notgroschenTarget: ngT,
          portfolioBrokerCash: broker,
        });
      } catch {
        /* offline */
      } finally {
        pulling = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearPendingCloudPersist();
      void pullMoneyFromCloud();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [authUser?.id, authToken, BILLING_API, cloudUserStateReady, clearPendingCloudPersist]);

  useEffect(() => {
    const applyCheckoutResult = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const checkoutState = params.get('checkout');
      if (!sessionId || checkoutState !== 'success') return;
      try {
        const res = await fetch(`${BILLING_API}/api/billing/checkout-session/${sessionId}`);
        if (!res.ok) throw new Error('lookup failed');
        const data = await res.json();
        if (data?.paid && (data?.tier === 'pro' || data?.tier === 'elite')) {
          setSub({ tier: data.tier, cycle: data.cycle === 'yearly' ? 'yearly' : 'monthly' });
          showToast(`Abo aktiv: ${PRICING[data.tier].name} ✅`);
          setTab('profile');
        }
      } catch {
        showToast('Abo konnte nicht verifiziert werden.', 'error');
      } finally {
        const clean = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, '', clean);
      }
    };
    void applyCheckoutResult();
  }, [BILLING_API]);

  const marketRef = useRef(market);
  marketRef.current = market;
  const watchlistExtrasRef = useRef(watchlistExtras);
  watchlistExtrasRef.current = watchlistExtras;
  const marketInstrumentsKey = useMemo(() => market.map((m) => m.sym).sort().join(','), [market]);

  const refreshMarketQuotes = useCallback(async () => {
    if (!BILLING_API || !isPaidPlan) return;
    const items = marketRef.current.map((m) => ({
      sym: m.sym,
      kind: marketKindForItem(m.sym, watchlistExtrasRef.current),
    }));
    if (!items.length) return;
    try {
      const quotes = await fetchMarketQuotes(BILLING_API, items);
      setMarket((prev) =>
        prev.map((m) => {
          const q = quotes[m.sym];
          if (!q || q.price == null) return m;
          return {
            ...m,
            price: q.price,
            change: q.change,
            quoteSource: q.source,
          };
        }),
      );
    } catch (e) {
      console.warn('[market] quotes', e);
    }
  }, [BILLING_API, isPaidPlan]);

  const loadMarketHistory = useCallback(
    async (sym: string) => {
      if (!BILLING_API || !isPaidPlan) return;
      setMarketHistoryLoading(sym);
      try {
        const kind = marketKindForItem(sym, watchlistExtrasRef.current);
        const data = await fetchMarketHistory(BILLING_API, sym, kind, 30);
        setMarket((prev) =>
          prev.map((m) =>
            m.sym === sym
              ? {
                  ...m,
                  historyDaily: data.history,
                  historySource: data.source,
                }
              : m,
          ),
        );
      } catch {
        showToast('Kursverlauf konnte nicht geladen werden.', 'error');
      } finally {
        setMarketHistoryLoading((cur) => (cur === sym ? null : cur));
      }
    },
    [BILLING_API, isPaidPlan],
  );

  useEffect(() => {
    if (!isPaidPlan) return;
    void refreshMarketQuotes();
    const id = window.setInterval(() => void refreshMarketQuotes(), 90_000);
    return () => clearInterval(id);
  }, [isPaidPlan, marketInstrumentsKey, refreshMarketQuotes]);

  const isinMigrateRef = useRef(new Set<string>());
  useEffect(() => {
    if (!BILLING_API) return;
    const pending = watchlistExtras.filter((e) => isIsinCode(e.sym) && !isinMigrateRef.current.has(e.sym));
    if (!pending.length) return;
    void (async () => {
      for (const ex of pending) {
        isinMigrateRef.current.add(ex.sym);
        try {
          const r = await fetchInstrumentResolve(BILLING_API, ex.sym, ex.kind, ex.name);
          renameInstrumentSym(ex.sym, {
            sym: r.sym,
            name: ex.name && !isIsinCode(ex.name) ? ex.name : r.name,
            kind: r.kind,
            isin: r.isin || normalizeIsin(ex.sym),
            logoUrl: r.logoUrl,
            logoUrlFallbacks: r.logoUrlFallbacks,
          });
        } catch {
          /* ISIN bleibt bis manuell korrigiert */
        }
      }
      void refreshMarketQuotes();
    })();
  }, [watchlistExtras, BILLING_API, refreshMarketQuotes]);

  const instrumentMetaRefreshRef = useRef(new Set<string>());
  useEffect(() => {
    if (!BILLING_API) return;
    const pending = watchlistExtras.filter(
      (e) =>
        e.kind === 'stock' &&
        !instrumentMetaRefreshRef.current.has(e.sym) &&
        (instrumentNameNeedsRefresh(e.sym, e.name) || !!e.isin),
    );
    if (!pending.length) return;
    void (async () => {
      for (const ex of pending) {
        instrumentMetaRefreshRef.current.add(ex.sym);
        try {
          const r = await fetchInstrumentResolve(BILLING_API, ex.isin || ex.sym, ex.kind, ex.name);
          const nextName =
            r.name && !instrumentNameNeedsRefresh(ex.sym, r.name) ? r.name.trim().slice(0, 56) : ex.name;
          const hasLogo = !!r.logoUrl;
          const hasName = nextName !== ex.name && !instrumentNameNeedsRefresh(ex.sym, nextName);
          if (!hasLogo && !hasName) continue;
          setWatchlistExtras((prev) =>
            prev.map((x) =>
              x.sym === ex.sym
                ? {
                    ...x,
                    ...(hasName ? { name: nextName } : {}),
                    ...(hasLogo ? { logoUrl: r.logoUrl } : {}),
                    ...(r.logoUrlFallbacks?.length ? { logoUrlFallbacks: r.logoUrlFallbacks } : {}),
                  }
                : x,
            ),
          );
          setMarket((prev) =>
            prev.map((m) => {
              if (m.sym !== ex.sym) return m;
              const next = buildMarketItemFromExtra({
                sym: ex.sym,
                name: hasName ? nextName : ex.name,
                kind: ex.kind,
                isin: ex.isin,
                logoUrl: r.logoUrl || ex.logoUrl,
                logoUrlFallbacks: r.logoUrlFallbacks || ex.logoUrlFallbacks,
                watchlistOnly: ex.watchlistOnly,
              });
              return {
                ...next,
                price: m.price,
                change: m.change,
                historyDaily: m.historyDaily,
                historySource: m.historySource,
                quoteSource: m.quoteSource,
              };
            }),
          );
        } catch {
          /* Kürzel/ISIN bleibt bis manuell korrigiert */
        }
      }
    })();
  }, [watchlistExtras, BILLING_API]);

  useEffect(() => {
    if (tradableMarket.length === 0) return;
    if (!tradableMarket.some((m) => m.sym === tradeSym)) {
      setTradeSym(tradableMarket[0]!.sym);
    }
  }, [tradableMarket, tradeSym]);

  const showToast = (msg: string, type: 'success' | 'error' | 'level' = 'success') => {
    setToast({ msg, type });
    const ms = type === 'error' ? 8000 : 3000;
    setTimeout(() => setToast(null), ms);
  };

  useEffect(() => {
    try {
      localStorage.setItem('allwin.watchlistExtras', JSON.stringify(watchlistExtras));
    } catch {
      /* noop */
    }
  }, [watchlistExtras]);

  useEffect(() => {
    try {
      localStorage.setItem('allwin.portfolioExcludedBaseSyms', JSON.stringify(portfolioExcludedBaseSyms));
    } catch {
      /* noop */
    }
  }, [portfolioExcludedBaseSyms]);

  useEffect(() => {
    if (authUser) return;
    try {
      localStorage.setItem(ORDEN_EARNED_STORAGE_KEY, JSON.stringify(earnedOrdenPresetIds));
    } catch {
      /* noop */
    }
  }, [authUser, earnedOrdenPresetIds]);

  const applyResolvedInstrument = (
    resolved: {
      sym: string;
      name: string;
      kind: 'stock' | 'crypto';
      isin?: string;
      logoUrl?: string;
      logoUrlFallbacks?: string[];
    },
    watchlistOnly: boolean,
    toastLabel?: string,
  ) => {
    const sym = sanitizeWatchlistSymbol(resolved.sym) || resolved.sym.toUpperCase();
    if (BASE_SYM_SET.has(sym)) {
      showToast(`${sym} ist bereits Teil der Standard-Watchlist.`, 'error');
      return;
    }
    if (market.some((m) => m.sym === sym)) {
      showToast(`${sym} steht schon in der Watchlist.`, 'error');
      return;
    }
    if (watchlistExtras.length >= 40) {
      showToast('Maximal 40 eigene Instrumente.', 'error');
      return;
    }
    const name = resolved.name.trim().slice(0, 56) || sym;
    const kind = resolved.kind;
    const extra: WatchlistExtraPersist = {
      sym,
      name,
      kind,
      ...(resolved.isin ? { isin: resolved.isin } : {}),
      ...(resolved.logoUrl ? { logoUrl: resolved.logoUrl } : {}),
      ...(resolved.logoUrlFallbacks?.length ? { logoUrlFallbacks: resolved.logoUrlFallbacks } : {}),
      ...(watchlistOnly ? { watchlistOnly: true } : {}),
    };
    const item = buildMarketItemFromExtra(extra);
    setWatchlistExtras((prev) => [...prev, extra]);
    setMarket((prev) => [...prev, item]);
    if (!watchlistOnly) {
      setPortfolioShares((prev) => ({ ...prev, [sym]: prev[sym] ?? 0 }));
    }
    setWlAddSym('');
    setWlAddName('');
    setLiveMarketAddOpen(false);
    setOrderInstrumentAddOpen(false);
    const label = toastLabel || name;
    showToast(
      watchlistOnly
        ? `${label} (${sym}) nur in Live Marktdaten ✅`
        : `${label} (${sym}) zur Watchlist hinzugefügt ✅`,
    );
  };

  const renameInstrumentSym = (
    oldSym: string,
    resolved: {
      sym: string;
      name: string;
      kind: 'stock' | 'crypto';
      isin?: string;
      logoUrl?: string;
      logoUrlFallbacks?: string[];
    },
  ) => {
    const newSym = sanitizeWatchlistSymbol(resolved.sym) || resolved.sym.toUpperCase();
    if (oldSym === newSym) {
      setWatchlistExtras((prev) =>
        prev.map((x) =>
          x.sym === oldSym
            ? {
                ...x,
                name: resolved.name,
                kind: resolved.kind,
                ...(resolved.isin ? { isin: resolved.isin } : {}),
                ...(resolved.logoUrl ? { logoUrl: resolved.logoUrl } : {}),
                ...(resolved.logoUrlFallbacks?.length ? { logoUrlFallbacks: resolved.logoUrlFallbacks } : {}),
              }
            : x,
        ),
      );
      setMarket((prev) =>
        prev.map((m) =>
          m.sym === oldSym
            ? buildMarketItemFromExtra({
                sym: newSym,
                name: resolved.name,
                kind: resolved.kind,
                isin: resolved.isin,
                logoUrl: resolved.logoUrl,
                logoUrlFallbacks: resolved.logoUrlFallbacks,
              })
            : m,
        ),
      );
      return;
    }
    setWatchlistExtras((prev) =>
      prev
        .filter((x) => x.sym !== oldSym)
        .concat({
          sym: newSym,
          name: resolved.name,
          kind: resolved.kind,
          ...(resolved.isin ? { isin: resolved.isin } : {}),
          ...(resolved.logoUrl ? { logoUrl: resolved.logoUrl } : {}),
          ...(resolved.logoUrlFallbacks?.length ? { logoUrlFallbacks: resolved.logoUrlFallbacks } : {}),
          ...(prev.find((x) => x.sym === oldSym)?.watchlistOnly ? { watchlistOnly: true } : {}),
        }),
    );
    setMarket((prev) => {
      const old = prev.find((m) => m.sym === oldSym);
      const extra: WatchlistExtraPersist = {
        sym: newSym,
        name: resolved.name,
        kind: resolved.kind,
        isin: resolved.isin,
        logoUrl: resolved.logoUrl,
        logoUrlFallbacks: resolved.logoUrlFallbacks,
      };
      const item = { ...buildMarketItemFromExtra(extra), price: old?.price ?? 0, change: old?.change ?? 0, historyDaily: old?.historyDaily };
      return prev.filter((m) => m.sym !== oldSym).concat(item);
    });
    setPortfolioShares((prev) => {
      const sh = prev[oldSym];
      if (sh == null) return prev;
      const next = { ...prev };
      delete next[oldSym];
      next[newSym] = sh;
      return next;
    });
    setPortfolioTrades((prev) => prev.map((t) => (t.sym === oldSym ? { ...t, sym: newSym } : t)));
    if (tradeSym === oldSym) setTradeSym(newSym);
    if (marketDetailSym === oldSym) setMarketDetailSym(newSym);
  };

  const addWatchlistInstrument = async (opts?: { watchlistOnly?: boolean }) => {
    const watchlistOnly = opts?.watchlistOnly === true;
    const raw = wlAddSym.trim();
    if (!raw) {
      showToast('Bitte Börsen-Kürzel oder ISIN eingeben.', 'error');
      return;
    }
    const kind = wlAddKind === 'crypto' ? 'crypto' : 'stock';
    setWlAddLoading(true);
    try {
      let resolved: {
        sym: string;
        name: string;
        kind: 'stock' | 'crypto';
        isin?: string;
        logoUrl?: string;
        logoUrlFallbacks?: string[];
      };
      if (BILLING_API) {
        const r = await fetchInstrumentResolve(BILLING_API, raw, kind, wlAddName.trim());
        resolved = {
          sym: r.sym,
          name: wlAddName.trim() || r.name,
          kind: r.kind,
          isin: r.isin,
          logoUrl: r.logoUrl,
          logoUrlFallbacks: r.logoUrlFallbacks,
        };
      } else if (isIsinCode(raw)) {
        showToast('ISIN-Auflösung braucht den Billing-Server (Railway).', 'error');
        return;
      } else {
        const sym = sanitizeWatchlistSymbol(raw);
        if (!sym) {
          showToast('Ungültiges Börsen-Kürzel — z. B. AAPL, SAP.DE, BTC.', 'error');
          return;
        }
        resolved = { sym, name: wlAddName.trim() || sym, kind };
      }
      applyResolvedInstrument(resolved, watchlistOnly);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Instrument konnte nicht hinzugefügt werden.', 'error');
    } finally {
      setWlAddLoading(false);
    }
  };

  const removeWatchlistInstrument = (symRaw: string) => {
    const s = sanitizeWatchlistSymbol(symRaw);
    if (!s || BASE_SYM_SET.has(s)) return;
    setWatchlistExtras((prev) => prev.filter((x) => sanitizeWatchlistSymbol(x.sym) !== s));
    setMarket((prev) => prev.filter((m) => m.sym !== s));
    setPortfolioShares((prev) => {
      const next = { ...prev };
      delete next[s];
      return next;
    });
    setPortfolioTrades((prev) => prev.filter((t) => t.sym !== s));
    setTradeSym((cur) => (cur === s ? BASE_MARKET[0].sym : cur));
    showToast(`${s} entfernt.`);
  };

  /** Standardtitel (BTC, …) nur aus Portfolio Power / Order ausblenden — Live bleibt. Nur bei Bestand 0. */
  const excludeBaselineFromPortfolioPower = (symRaw: string) => {
    const s = sanitizeWatchlistSymbol(symRaw);
    if (!s || !BASE_SYM_SET.has(s)) return;
    const held = portfolioShares[s] ?? 0;
    if (held > 1e-12) {
      showToast('Zuerst verkaufen — mit Bestand > 0 kann der Titel hier nicht entfernt werden.', 'error');
      return;
    }
    const hypotheticalExcluded = Array.from(new Set([...portfolioExcludedBaseSyms, s]));
    const visibleBaseSyms = BASE_MARKET.filter((bm) => {
      const h = portfolioShares[bm.sym] ?? 0;
      if (h > 1e-12) return true;
      return !hypotheticalExcluded.includes(bm.sym);
    });
    const hasTradableUserExtra = watchlistExtras.some((ex) => {
      const sx = sanitizeWatchlistSymbol(ex.sym);
      return !!(sx && !BASE_SYM_SET.has(sx) && ex.watchlistOnly !== true);
    });
    if (visibleBaseSyms.length === 0 && !hasTradableUserExtra) {
      showToast('Mindestens ein Standard-Titel bleibt unter Portfolio sichtbar — oder ein eigenes (handelbares) anlegen.', 'error');
      return;
    }
    setPortfolioExcludedBaseSyms((prev) => (prev.includes(s) ? prev : [...prev, s]));
    showToast(`${s} unter Portfolio ausgeblendet (Live Marktdaten unverändert).`);
  };

  const completeOnboarding = (p: OnboardingV2Payload) => {
    setOnboardingV2(p);
    setLevelUpMode(p.levelUpMode);
    const target = notgroschenTargetFromIncome(p.netIncomeMonthly);
    const emergencyBalance = p.emergency.has ? Math.max(0, p.emergency.balance) : 0;
    setNotgroschenTarget(target);
    setNotgroschenBalance(emergencyBalance);
    const mapped: Debt[] = p.debts.map((row, i) => ({
      id: i + 1,
      name: row.name.trim(),
      total: row.total,
      remaining: row.total,
      interest: 0,
      monthly: row.monthly,
      kind: row.kind,
    }));
    setDebts(mapped);
    let projectedPortfolioPower = portfolioBrokerCash;
    if (p.invest) {
      const sh = sharesFromOnboardingInvest(
        p.invest,
        tradableMarket.map(({ sym, price }) => ({ sym, price })),
      );
      if (sh) {
        setPortfolioShares(normalizePortfolioShares(sh, tradableMarket));
        projectedPortfolioPower += portfolioEuroValue(sh, tradableMarket);
      }
    }
    projectedPortfolioPower = Math.round(projectedPortfolioPower * 100) / 100;
    prevNotgroschenGoalMetRef.current = target > 0 && emergencyBalance >= target;
    prevAllDebtsPaidRef.current = mapped.length > 0 && mapped.every((d) => d.remaining <= 0);
    prevPortfolioPowerForMilestoneRef.current = projectedPortfolioPower;
    const seededCelebrated = readCelebratedPortfolioMilestones(authUser?.id);
    for (const m of PORTFOLIO_POWER_MILESTONE_EURS) {
      if (projectedPortfolioPower >= m) seededCelebrated.add(m);
    }
    writeCelebratedPortfolioMilestones(authUser?.id, seededCelebrated);
    setCelebratedMilestones(seededCelebrated);
    setOnboardingDone(true);
    writeLocalOnboardingDone(authUser?.id, authUser?.email);
    cloudOnboardingHydratedRef.current = true;
    setTab('dashboard');
    if (authToken) {
      void fetch(`${BILLING_API}/api/user/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          state: {
            onboarding: { done: true, v2: p },
          },
        }),
      }).catch(() => {
        showToast('Onboarding gespeichert — Sync folgt beim nächsten Laden.', 'success');
      });
    }
    if (typeof window !== 'undefined' && !localStorage.getItem(APP_TOUR_STORAGE_KEY)) {
      setAppTourOpen(true);
    } else {
      showToast('Clever Finance ist bereit! 🎉');
    }
  };

  const closeAppTour = () => {
    setAppTourOpen(false);
    if (typeof window !== 'undefined') localStorage.setItem(APP_TOUR_STORAGE_KEY, '1');
    showToast('Tour abgeschlossen — viel Erfolg! 🎉');
  };

  const startAppTour = () => {
    setProfileSection('overview');
    setTab('dashboard');
    setAppTourOpen(true);
  };

  /** Onboarding erneut — Wizard erscheint erneut; Schulden werden beim Abschluss überschrieben. */
  const restartOnboarding = () => {
    setOnboardingDone(false);
    setOnboardingV2(null);
    setLevelUpMode('full');
    setWizardRemount((n) => n + 1);
    setProfileSection('overview');
    setTab('dashboard');
    if (authUser?.id || authUser?.email) {
      try {
        if (authUser.id) localStorage.removeItem(onboardingDoneStorageKey(authUser.id));
        if (authUser.email) localStorage.removeItem(onboardingDoneEmailKey(authUser.email));
      } catch {
        /* ignore */
      }
    }
    if (authToken) {
      void fetch(`${BILLING_API}/api/user/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ state: { onboarding: { done: false, reset: true, v2: null } } }),
      });
    }
    showToast('Onboarding startet neu.', 'success');
  };

  const submitPortfolioTrade = (opts?: { sellAll?: boolean }) => {
    const sym = tradeSym;
    const row = market.find((x) => x.sym === sym);
    const px = row?.price ?? 0;
    const roundEUR = (v: number) => Math.round(v * 100) / 100;
    if (!(px > 0)) {
      showToast('Marktkurs noch nicht geladen — Live Marktdaten kurz warten oder Seite neu laden.', 'error');
      void refreshMarketQuotes();
      return;
    }
    let n: number;
    if (tradeMode === 'buy') {
      const raw = tradeAmount.replace(/\s/g, '').replace(',', '.');
      n = parseFloat(raw);
      if (Number.isNaN(n) || n <= 0) {
        showToast('Bitte eine gültige Stückzahl eingeben.', 'error');
        return;
      }
    } else if (opts?.sellAll === true) {
      n = portfolioShares[sym] ?? 0;
      if (n <= 0) {
        showToast('Nichts zu verkaufen (0 Stück).', 'error');
        return;
      }
    } else {
      const raw = tradeAmount.replace(/\s/g, '').replace(',', '.');
      n = parseFloat(raw);
      if (Number.isNaN(n) || n <= 0) {
        showToast('Bitte eine gültige Stückzahl eingeben.', 'error');
        return;
      }
    }
    const feeEur = parseEuroInput(tradeFeeStr);
    const taxEur = parseEuroInput(tradeTaxStr);
    if (tradeMode === 'buy') {
      const cashAvail = roundEUR(portfolioBrokerCash);
      const wishSpend = roundEUR(n * px);
      const cashForShares = Math.max(0, roundEUR(cashAvail - feeEur - taxEur));
      const spend = Math.min(wishSpend, cashForShares);
      if (spend <= 0) {
        showToast(
          feeEur + taxEur >= cashAvail
            ? 'Nicht genug Cash Depot für Order inkl. Gebühr/Steuer.'
            : 'Kein Cash im Cash Depot — Betrag dort erhöhen (LevelUp · Cash Depot bearbeiten).',
          'error',
        );
        return;
      }
      const sharesAdded = spend / px;
      const cashOut = roundEUR(spend + feeEur + taxEur);
      setPortfolioExcludedBaseSyms((prev) => prev.filter((x) => x !== sym));
      setPortfolioShares((prev) => ({ ...prev, [sym]: (prev[sym] ?? 0) + sharesAdded }));
      setPortfolioBrokerCash((prev) => {
        const next = roundEUR(roundEUR(prev) - cashOut);
        return next < 0 ? 0 : next;
      });
      setPortfolioTrades((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            at: new Date().toLocaleString('de-DE'),
            kind: 'buy' as const,
            sym,
            amount: sharesAdded,
            pricePerShareEur: roundEUR(px),
            totalEur: roundEUR(spend),
            ...(feeEur > 0 ? { feeEur } : {}),
            ...(taxEur > 0 ? { taxEur } : {}),
          },
          ...prev,
        ].slice(0, 60),
      );
      setTradeAmount('');
      setTradeFeeStr('');
      setTradeTaxStr('');
      const cappedByCash = wishSpend > cashForShares + 1e-9;
      const feeHint = feeEur + taxEur > 0 ? ` · inkl. Gebühr/Steuer ${fmt(feeEur + taxEur)}` : '';
      const msg = cappedByCash
        ? `🟢 +${fmtStk(sharesAdded)} Stk ${sym} für ${fmt(spend)}${feeHint} (gekappt — nicht genug Cash Depot)`
        : `🟢 +${fmtStk(sharesAdded)} Stk ${sym} (~${fmt(spend)}${feeHint})`;
      showToast(msg);
      return;
    }
    const held = portfolioShares[sym] ?? 0;
    const sold = Math.min(n, held);
    if (sold <= 0) {
      showToast('Nichts zu verkaufen (0 Stück).', 'error');
      return;
    }
    const capped = sold < n - 1e-12;
    const proceeds = roundEUR(sold * px);
    const netProceeds = roundEUR(proceeds - feeEur - taxEur);
    if (netProceeds < -0.001) {
      showToast('Gebühr + Steuer übersteigen den Verkaufserlös.', 'error');
      return;
    }
    const fullySold = opts?.sellAll === true && !capped && held - sold <= 1e-12;
    const isBase = BASE_SYM_SET.has(sym);
    setPortfolioShares((prev) => ({ ...prev, [sym]: held - sold }));
    setPortfolioBrokerCash((prev) => roundEUR(Math.max(0, roundEUR(prev) + netProceeds)));
    const newTrade: PortfolioTrade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toLocaleString('de-DE'),
      kind: 'sell' as const,
      sym,
      amount: sold,
      pricePerShareEur: roundEUR(px),
      totalEur: roundEUR(proceeds),
      ...(feeEur > 0 ? { feeEur } : {}),
      ...(taxEur > 0 ? { taxEur } : {}),
    };
    setPortfolioTrades((prev) => [newTrade, ...(fullySold && !isBase ? prev.filter((t) => t.sym !== sym) : prev)].slice(0, 60));
    if (fullySold && !isBase) {
      setWatchlistExtras((p) => p.filter((x) => sanitizeWatchlistSymbol(x.sym) !== sym));
      setMarket((p) => p.filter((m) => m.sym !== sym));
      setPortfolioShares((prev) => {
        const next = { ...prev };
        delete next[sym];
        return next;
      });
    }
    setTradeAmount('');
    setTradeFeeStr('');
    setTradeTaxStr('');
    const feeHint = feeEur + taxEur > 0 ? ` (netto ${fmt(netProceeds)} nach Gebühr/Steuer)` : '';
    let baselineExcluded = false;
    if (fullySold && isBase) {
      const hypotheticalExcluded = Array.from(new Set([...portfolioExcludedBaseSyms, sym]));
      const visibleBaseSyms = BASE_MARKET.filter((bm) => {
        const sh = bm.sym === sym ? 0 : portfolioShares[bm.sym] ?? 0;
        if (sh > 1e-12) return true;
        return !hypotheticalExcluded.includes(bm.sym);
      });
      const hasTradableUserExtra = watchlistExtras.some((ex) => {
        const sx = sanitizeWatchlistSymbol(ex.sym);
        return !!(sx && !BASE_SYM_SET.has(sx) && ex.watchlistOnly !== true);
      });
      baselineExcluded = !(visibleBaseSyms.length === 0 && !hasTradableUserExtra);
      if (baselineExcluded) {
        setPortfolioExcludedBaseSyms((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
      }
    }
    showToast(
      fullySold && !isBase
        ? `🔴 ${fmtStk(sold)} Stk ${sym} · +${fmt(netProceeds)}${feeHint} — Titel wurde entfernt`
        : fullySold && isBase && baselineExcluded
          ? `🔴 ${fmtStk(sold)} Stk ${sym} · +${fmt(netProceeds)}${feeHint} — unter Portfolio ausgeblendet`
          : fullySold && isBase
            ? `🔴 ${fmtStk(sold)} Stk ${sym} · +${fmt(netProceeds)}${feeHint} · Ausblendung nicht möglich (letzter sichtbarer Standard-Titel); Live unverändert`
            : `🔴 ${fmtStk(sold)} Stk ${sym} · +${fmt(netProceeds)}${feeHint} ins Cash Depot${capped ? ' (max. Bestand)' : ''}`,
    );
  };

  const startEditPortfolioTrade = (t: PortfolioTrade) => {
    setEditingTradeId(t.id);
    setTradeEditAmount(String(t.amount).replace('.', ','));
    setTradeEditPrice(
      typeof t.pricePerShareEur === 'number' ? String(t.pricePerShareEur).replace('.', ',') : '',
    );
    setTradeEditFeeStr(typeof t.feeEur === 'number' && t.feeEur > 0 ? String(t.feeEur).replace('.', ',') : '');
    setTradeEditTaxStr(typeof t.taxEur === 'number' && t.taxEur > 0 ? String(t.taxEur).replace('.', ',') : '');
    setTradeEditDate(t.at);
  };

  const cancelEditPortfolioTrade = () => {
    setEditingTradeId(null);
    setTradeEditAmount('');
    setTradeEditPrice('');
    setTradeEditFeeStr('');
    setTradeEditTaxStr('');
    setTradeEditDate('');
  };

  const deletePortfolioTrade = (id: string) => {
    const t = portfolioTrades.find((x) => x.id === id);
    if (!t) return;
    if (!window.confirm('Diese Depot-Buchung löschen? Bestand und Cash Depot werden entsprechend angepasst.')) return;
    const { shares, cash } = reverseTradeOnPortfolio(t, portfolioShares, portfolioBrokerCash);
    setPortfolioShares(shares);
    setPortfolioBrokerCash(cash);
    setPortfolioTrades((prev) => prev.filter((x) => x.id !== id));
    if (editingTradeId === id) cancelEditPortfolioTrade();
    showToast('Depot-Buchung gelöscht.');
  };

  const saveEditedPortfolioTrade = () => {
    const old = portfolioTrades.find((t) => t.id === editingTradeId);
    if (!old) return;
    const amount = parseFloat(tradeEditAmount.replace(/\s/g, '').replace(',', '.'));
    const price = parseFloat(tradeEditPrice.replace(/\s/g, '').replace(',', '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      showToast('Bitte gültige Stückzahl eingeben.', 'error');
      return;
    }
    if (Number.isNaN(price) || price <= 0) {
      showToast('Bitte gültigen Kurs je Stück eingeben.', 'error');
      return;
    }
    const feeEur = parseEuroInput(tradeEditFeeStr);
    const taxEur = parseEuroInput(tradeEditTaxStr);
    const updated: PortfolioTrade = {
      ...old,
      amount,
      pricePerShareEur: roundTradeEur(price),
      totalEur: roundTradeEur(amount * price),
      at: tradeEditDate.trim() || old.at,
    };
    if (feeEur > 0) updated.feeEur = feeEur;
    else delete updated.feeEur;
    if (taxEur > 0) updated.taxEur = taxEur;
    else delete updated.taxEur;
    let shares = portfolioShares;
    let cash = portfolioBrokerCash;
    const rev = reverseTradeOnPortfolio(old, shares, cash);
    shares = rev.shares;
    cash = rev.cash;
    const app = applyTradeOnPortfolio(updated, shares, cash);
    setPortfolioShares(app.shares);
    setPortfolioBrokerCash(app.cash);
    setPortfolioTrades((prev) => prev.map((t) => (t.id === old.id ? updated : t)));
    cancelEditPortfolioTrade();
    showToast('Depot-Buchung aktualisiert ✅');
  };

  const resetMoneyForm = () => {
    setEditingTxId(null);
    setForm({
      type: 'ausgabe',
      amount: '',
      currency: baseCurrency,
      category: CATS.ausgaben[0],
      note: '',
      date: todayIsoDate(),
      paymentMethod: '',
      linkedDebtId: '',
      feeStr: '',
      taxStr: '',
    });
  };

  const onReceiptFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!BILLING_API) {
      showToast('Backend nicht erreichbar — Billing-Server / VITE_BILLING_API_URL prüfen.', 'error');
      return;
    }
    if (!authToken) {
      showToast('Bitte anmelden, um Kassenzettel zu scannen.', 'error');
      return;
    }
    setReceiptScanning(true);
    try {
      const { base64, mimeType } = await compressReceiptImageFile(file);
      const res = await fetch(`${BILLING_API}/api/receipt/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        suggestion?: {
          amount: number;
          date?: string;
          note?: string;
          category?: string;
          paymentMethod?: string;
          confidence?: string;
        };
      };
      if (!res.ok) {
        showToast(data?.error || 'Scan fehlgeschlagen.', 'error');
        return;
      }
      const s = data.suggestion;
      if (!s?.amount) {
        showToast('Keine Buchungsdaten erkannt.', 'error');
        return;
      }
      const cat = s.category && CATS.ausgaben.includes(s.category) ? s.category : 'Sonstiges';
      const pm = String(s.paymentMethod || '');
      const pmOk = (PAYMENT_METHOD_OPTIONS as readonly string[]).includes(pm) ? pm : '';
      setEditingTxId(null);
      setForm((f) => ({
        ...f,
        type: 'ausgabe',
        amount: String(s.amount),
        date: s.date && /^\d{4}-\d{2}-\d{2}/.test(s.date) ? s.date : f.date,
        category: cat,
        note: String(s.note || '').trim().slice(0, 200),
        paymentMethod: pmOk,
        linkedDebtId: cat === 'Kreditrate' ? f.linkedDebtId : '',
      }));
      setMoneyFormOpen(true);
      const conf =
        s.confidence === 'high' ? 'sicher' : s.confidence === 'low' ? 'unsicher — bitte prüfen' : 'plausibel';
      showToast(`Kassenzettel erkannt (${conf}). Daten prüfen und speichern.`, s.confidence === 'low' ? 'error' : 'success');
    } catch {
      showToast('Beleg konnte nicht gelesen werden — anderes Foto versuchen.', 'error');
    } finally {
      setReceiptScanning(false);
    }
  };

  const deleteTx = async (id: number) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    if (!window.confirm('Diese Buchung wirklich löschen?')) return;
    const rev = reverseTxSideEffects(tx, debts, notgroschenBalance, portfolioBrokerCash);
    const nextTx = transactions.filter((t) => t.id !== id);
    if (authUser?.id) markTxDeleted(authUser.id, id);
    clearPendingCloudPersist();
    flushSync(() => {
      setTx(nextTx);
      setDebts(rev.debts);
      setNotgroschenBalance(rev.notgroschenBalance);
      setPortfolioBrokerCash(rev.portfolioBrokerCash);
    });
    const ok = await persistUserState(
      {
        transactions: nextTx,
        debts: rev.debts,
        notgroschenBalance: rev.notgroschenBalance,
        portfolioBrokerCash: rev.portfolioBrokerCash,
      },
      { replaceTransactions: true, replaceDebts: true },
    );
    if (editingTxId === id) resetMoneyForm();
    showToast(ok ? 'Buchung gelöscht.' : 'Lokal gelöscht — Cloud-Sync fehlgeschlagen. Bitte erneut versuchen.', ok ? 'success' : 'error');
  };

  const startEditTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setMoneyFormOpen(true);
    setForm({
      type: tx.type,
      amount:
        tx.foreignAmount != null && tx.foreignCurrency && tx.foreignCurrency !== baseCurrency
          ? String(tx.foreignAmount).replace('.', ',')
          : String(tx.amount).replace('.', ','),
      currency:
        tx.foreignCurrency && tx.foreignCurrency !== baseCurrency ? tx.foreignCurrency : baseCurrency,
      category: tx.category,
      note: tx.note || '',
      date: txDateToInputValue(tx.date),
      paymentMethod: tx.paymentMethod || '',
      linkedDebtId: tx.linkedDebtId != null ? String(tx.linkedDebtId) : '',
      feeStr: typeof tx.feeEur === 'number' && tx.feeEur > 0 ? String(tx.feeEur).replace('.', ',') : '',
      taxStr: typeof tx.taxEur === 'number' && tx.taxEur > 0 ? String(tx.taxEur).replace('.', ',') : '',
    });
    showToast('Buchung geladen — unten anpassen und speichern.', 'success');
  };

  const addTx = () => {
    const rawAmt = parseFloat(String(form.amount).replace(/\s/g, '').replace(',', '.'));
    if (!String(form.amount).trim() || Number.isNaN(rawAmt) || rawAmt <= 0) return;

    let amt: number;
    let foreignAmount: number | undefined;
    let foreignCurrency: string | undefined;
    let fxRateToEur: number | undefined;

    if (form.currency !== baseCurrency) {
      if (!Number.isFinite(fxBasePerUnit) || fxBasePerUnit <= 0) {
        showToast(fxError || 'Wechselkurs noch nicht geladen — bitte kurz warten.', 'error');
        return;
      }
      foreignAmount = Math.round(rawAmt * 100) / 100;
      foreignCurrency = form.currency;
      fxRateToEur = fxBasePerUnit;
      amt = convertForeignToBase(rawAmt, fxBasePerUnit);
    } else {
      amt = Math.round(rawAmt * 100) / 100;
    }

    const feeEur = parseEuroInput(form.feeStr);
    const taxEur = parseEuroInput(form.taxStr);
    if (form.type === 'einnahme' && form.category === 'Dividende' && amt - feeEur - taxEur < -0.001) {
      showToast('Gebühr + Steuer dürfen den Bruttobetrag nicht übersteigen.', 'error');
      return;
    }

    const oldTx = editingTxId != null ? transactions.find((t) => t.id === editingTxId) : undefined;
    let workDebts = debts;
    let workNg = notgroschenBalance;
    let workBroker = portfolioBrokerCash;

    if (form.type === 'ausgabe' && form.category === 'Notgroschen' && form.paymentMethod === 'Notgroschen') {
      showToast(
        'Kategorie „Notgroschen“ = Einzahlung aufs Polster. Zahlung aus dem Polster: andere Kategorie wählen und Zahlungsart „Notgroschen“.',
        'error',
      );
      return;
    }
    if (oldTx) {
      const rev = reverseTxSideEffects(oldTx, workDebts, workNg, workBroker);
      workDebts = rev.debts;
      workNg = rev.notgroschenBalance;
      workBroker = rev.portfolioBrokerCash;
    }

    const activeForLink = workDebts.filter((d) => d.remaining > 0);
    if (form.type === 'ausgabe' && form.category === 'Kreditrate' && activeForLink.length > 0 && !form.linkedDebtId) {
      showToast('Bitte eine Schuld unter Boost auswählen (oder Kategorie ändern).', 'error');
      return;
    }

    if (form.type === 'ausgabe' && form.paymentMethod === 'Notgroschen' && amt > workNg + 0.0001) {
      showToast(`Im Notgroschen sind nur noch ${fmt(workNg)} verfügbar.`, 'error');
      return;
    }
    if (form.type === 'ausgabe' && form.paymentMethod === 'Cash Depot' && amt > workBroker + 0.0001) {
      showToast(`Im Cash Depot sind nur noch ${fmt(workBroker)} verfügbar.`, 'error');
      return;
    }

    if (form.type === 'ausgabe' && form.category === 'Notgroschen' && form.paymentMethod === 'Einzahlung Cash Depot') {
      showToast(
        '„Einzahlung Cash Depot“ bucht ins Broker-Cash (LevelUp). Für den Notgroschen auf Home andere Zahlungsart wählen — oder zwei getrennte Buchungen.',
        'error',
      );
      return;
    }

    let linkedDebtId: number | undefined;
    let linkedDebtName: string | undefined;
    let tilgRestAfter: number | undefined;
    if (form.type === 'ausgabe' && form.category === 'Kreditrate' && form.linkedDebtId) {
      const did = parseInt(form.linkedDebtId, 10);
      const dRow = workDebts.find((d) => d.id === did && d.remaining > 0);
      if (!dRow) {
        showToast('Schuld nicht gefunden oder schon erledigt.', 'error');
        return;
      }
      linkedDebtId = did;
      linkedDebtName = dRow.name;
      tilgRestAfter = Math.max(0, dRow.remaining - amt);
    }

    let notgroNewBal: number | undefined;
    if (
      form.type === 'ausgabe' &&
      form.category === 'Notgroschen' &&
      form.paymentMethod !== 'Notgroschen' &&
      form.paymentMethod !== 'Einzahlung Cash Depot'
    ) {
      notgroNewBal = Math.round((workNg + amt) * 100) / 100;
    }

    let notgroAfterDebit: number | undefined;
    if (form.type === 'ausgabe' && form.paymentMethod === 'Notgroschen') {
      notgroAfterDebit = Math.round((workNg - amt) * 100) / 100;
    }

    let brokerCashAfterSpend: number | undefined;
    if (form.type === 'ausgabe' && form.paymentMethod === 'Cash Depot') {
      brokerCashAfterSpend = Math.round((workBroker - amt) * 100) / 100;
    }

    let brokerCashAfterEinzahlung: number | undefined;
    if (form.type === 'ausgabe' && form.paymentMethod === 'Einzahlung Cash Depot') {
      brokerCashAfterEinzahlung = Math.round((workBroker + amt) * 100) / 100;
    }

    let brokerCashAfterDividend: number | undefined;
    if (form.type === 'einnahme' && form.category === 'Dividende') {
      const net = Math.round((amt - feeEur - taxEur) * 100) / 100;
      brokerCashAfterDividend = Math.round((workBroker + net) * 100) / 100;
    }

    const { paymentMethod, linkedDebtId: _ld, feeStr: _fee, taxStr: _tax, currency: _cur, ...rest } = form;
    const txDate = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? form.date : todayIsoDate();
    const row: Transaction = {
      ...rest,
      amount: amt,
      id: editingTxId ?? Date.now(),
      date: txDate,
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(linkedDebtId != null ? { linkedDebtId, linkedDebtName } : {}),
      ...(foreignCurrency && foreignAmount != null
        ? { foreignCurrency, foreignAmount, fxRateToEur }
        : {}),
      ...(form.type === 'ausgabe' && form.category === 'Notgroschen' && form.paymentMethod !== 'Notgroschen' && form.paymentMethod !== 'Einzahlung Cash Depot'
        ? { fillsNotgroschen: true }
        : {}),
      ...(form.type === 'ausgabe' && form.paymentMethod === 'Notgroschen' ? { debitsNotgroschen: true } : {}),
      ...(form.type === 'ausgabe' && form.paymentMethod === 'Cash Depot' ? { debitsCashDepot: true } : {}),
      ...(form.type === 'ausgabe' && form.paymentMethod === 'Einzahlung Cash Depot' ? { creditsCashDepot: true } : {}),
      ...(form.type === 'einnahme' && form.category === 'Dividende' && feeEur > 0 ? { feeEur } : {}),
      ...(form.type === 'einnahme' && form.category === 'Dividende' && taxEur > 0 ? { taxEur } : {}),
    };
    const baseTx = editingTxId != null ? transactions.filter((t) => t.id !== editingTxId) : transactions;
    const nextTransactions = [row, ...baseTx];
    let nextDebts = workDebts;
    if (form.type === 'ausgabe' && form.category === 'Kreditrate' && linkedDebtId != null && tilgRestAfter !== undefined) {
      const did = linkedDebtId;
      const stamp = new Date().toLocaleString('de-DE');
      nextDebts = workDebts.map((d) => {
        if (d.id !== did) return d;
        return tilgRestAfter === 0 ? { ...d, remaining: 0, archivedAt: d.archivedAt ?? stamp } : { ...d, remaining: tilgRestAfter };
      });
    }
    const nextNg = notgroNewBal ?? notgroAfterDebit ?? workNg;
    const nextBroker = brokerCashAfterSpend ?? brokerCashAfterEinzahlung ?? brokerCashAfterDividend ?? workBroker;
    flushSync(() => {
      setTx(nextTransactions);
      if (nextDebts !== debts) setDebts(nextDebts);
      if (nextNg !== notgroschenBalance) setNotgroschenBalance(nextNg);
      if (nextBroker !== portfolioBrokerCash) setPortfolioBrokerCash(nextBroker);
    });
    clearPendingCloudPersist();
    void persistUserState(
      {
        transactions: nextTransactions,
        debts: nextDebts,
        notgroschenBalance: nextNg,
        notgroschenTarget: notgroschenTarget,
        portfolioBrokerCash: nextBroker,
      },
      { replaceTransactions: true, replaceDebts: true },
    ).then((ok) => {
      if (!ok && authToken) {
        showToast('Lokal gespeichert — Cloud-Sync fehlgeschlagen. Bitte kurz warten und erneut speichern.', 'error');
      }
    });
    const wasEdit = editingTxId != null;
    resetMoneyForm();

    if (form.type === 'ausgabe' && form.category === 'Kreditrate' && linkedDebtId != null && linkedDebtName && tilgRestAfter !== undefined) {
      const ngSuffix =
        form.paymentMethod === 'Notgroschen' && notgroAfterDebit !== undefined ? ` · Notgroschen-Stand: ${fmt(notgroAfterDebit)}` : '';
      const cdSuffix =
        form.paymentMethod === 'Cash Depot' && brokerCashAfterSpend !== undefined ? ` · Cash Depot: ${fmt(brokerCashAfterSpend)}` : '';
      const einSuffix =
        form.paymentMethod === 'Einzahlung Cash Depot' && brokerCashAfterEinzahlung !== undefined
          ? ` · Cash Depot: ${fmt(brokerCashAfterEinzahlung)}`
          : '';
      if (tilgRestAfter === 0) {
        showToast(`🏆 „${linkedDebtName}“ abbezahlt — Boost-Archiv!${ngSuffix}${cdSuffix}${einSuffix}`, 'level');
      } else {
        showToast(`✅ Tilgung ${fmt(amt)} für „${linkedDebtName}“ — Rest ${fmt(tilgRestAfter)}${ngSuffix}${cdSuffix}${einSuffix}`);
      }
    } else if (form.type === 'ausgabe' && form.paymentMethod === 'Notgroschen' && notgroAfterDebit !== undefined) {
      showToast(`🛡️ −${fmt(amt)} aus Notgroschen — Stand jetzt ${fmt(notgroAfterDebit)}`);
    } else if (form.type === 'ausgabe' && form.category === 'Notgroschen' && notgroNewBal !== undefined) {
      const msg =
        form.paymentMethod === 'Cash Depot' && brokerCashAfterSpend !== undefined
          ? `🛡️ +${fmt(amt)} auf Notgroschen (aus Cash Depot) — NG ${fmt(notgroNewBal)} · Cash ${fmt(brokerCashAfterSpend)}`
          : `🛡️ +${fmt(amt)} auf Notgroschen — Stand jetzt ${fmt(notgroNewBal)}`;
      showToast(msg);
    } else if (
      form.type === 'ausgabe' &&
      form.paymentMethod === 'Cash Depot' &&
      brokerCashAfterSpend !== undefined &&
      !(form.category === 'Notgroschen' && form.paymentMethod === 'Cash Depot')
    ) {
      showToast(`💎 −${fmt(amt)} aus Cash Depot — Stand jetzt ${fmt(brokerCashAfterSpend)}`);
    } else if (form.type === 'ausgabe' && form.paymentMethod === 'Einzahlung Cash Depot' && brokerCashAfterEinzahlung !== undefined) {
      showToast(`💎 +${fmt(amt)} ins Cash Depot eingezahlt — Stand jetzt ${fmt(brokerCashAfterEinzahlung)}`);
    } else if (form.type === 'einnahme' && form.category === 'Dividende' && brokerCashAfterDividend !== undefined) {
      const net = Math.round((amt - feeEur - taxEur) * 100) / 100;
      const feeHint = feeEur + taxEur > 0 ? ` (netto ${fmt(net)} nach Gebühr/Steuer)` : '';
      showToast(`💸 Dividende gebucht${feeHint} — Cash Depot jetzt ${fmt(brokerCashAfterDividend)}`);
    } else {
      let msg = wasEdit
        ? '✏️ Buchung aktualisiert!'
        : form.type === 'einnahme'
          ? '💰 Einnahme gespeichert!'
          : '✅ Ausgabe gespeichert!';
      if (!wasEdit && form.type === 'ausgabe' && form.category === 'Kreditrate' && activeForLink.length === 0) {
        msg += ' Hinweis: In Boost eine Schuld anlegen, dann Tilgung hier zuordnen.';
      }
      if (!wasEdit && form.type === 'ausgabe' && FIXKOST_CATEGORIES.has(form.category)) {
        msg += ' In „Laufende Fixkosten“ siehst du den letzten Betrag je Position.';
      }
      if (!wasEdit && form.type === 'ausgabe' && VAR_KOST_CATEGORIES.has(form.category)) {
        msg += ' Unter „Variable Kosten“ siehst du den letzten Betrag je Kategorie + Notiz.';
      }
      showToast(msg);
    }
  };

  const payDebt = (id: number) => {
    const stamp = new Date().toLocaleString('de-DE');
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const newR = Math.max(0, d.remaining - d.monthly);
        if (newR === 0) showToast(`🏆 „${d.name}“ abbezahlt — liegt jetzt im Archiv!`, 'level');
        return newR === 0 ? { ...d, remaining: 0, archivedAt: d.archivedAt ?? stamp } : { ...d, remaining: newR };
      }),
    );
  };

  const updateDebtMonthly = (id: number, raw: string) => {
    if (raw === '' || raw === '-') {
      setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, monthly: 0 } : d)));
      return;
    }
    const n = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) return;
    const monthly = Math.min(Math.round(n * 100) / 100, 999_999);
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, monthly } : d)));
  };

  const settleDebtFull = (id: number) => {
    const stamp = new Date().toLocaleString('de-DE');
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        if (d.remaining <= 0) return d;
        showToast(`🏆 „${d.name}“ abgeschlossen — Archiv!`, 'level');
        return { ...d, remaining: 0, archivedAt: d.archivedAt ?? stamp };
      }),
    );
  };

  const resetDebtForm = () => {
    setEditingDebtId(null);
    setNewDebtName('');
    setNewDebtTotal('');
    setNewDebtInterest('');
    setNewDebtMonthly('');
    setNewDebtKind('consumer');
    setNewDebtPropertyValue('');
    setDebtAddOpen(false);
  };

  const parseDebtPropertyValueInput = (): number | undefined | 'invalid' => {
    const raw = newDebtPropertyValue.trim().replace(/\s/g, '').replace(',', '.');
    if (!raw) return undefined;
    const pv = parseFloat(raw);
    if (Number.isNaN(pv) || pv < 0) return 'invalid';
    return pv > 0 ? Math.round(pv * 100) / 100 : undefined;
  };

  const startEditDebt = (id: number) => {
    const d = debts.find((x) => x.id === id);
    if (!d) return;
    setEditingDebtId(id);
    setNewDebtName(d.name);
    setNewDebtTotal(String(d.total));
    setNewDebtInterest(String(d.interest));
    setNewDebtMonthly(String(d.monthly));
    setNewDebtKind(d.kind === 'house' ? 'house' : 'consumer');
    setNewDebtPropertyValue(d.kind === 'house' && debtPropertyValue(d) > 0 ? String(debtPropertyValue(d)) : '');
    setDebtAddOpen(true);
  };

  const addDebtEntry = () => {
    const name = newDebtName.trim();
    const total = parseFloat(newDebtTotal.replace(/\s/g, '').replace(',', '.'));
    const monthly = parseFloat(newDebtMonthly.replace(/\s/g, '').replace(',', '.'));
    const interestRaw = newDebtInterest.replace(/\s/g, '').replace(',', '.');
    const interest = interestRaw === '' ? 0 : parseFloat(interestRaw);
    if (!name) {
      showToast('Bitte einen Namen eingeben.', 'error');
      return;
    }
    if (Number.isNaN(total) || total <= 0) {
      showToast('Gesamtbetrag fehlt oder ungültig.', 'error');
      return;
    }
    if (Number.isNaN(monthly) || monthly < 0) {
      showToast('Monatsrate ungültig.', 'error');
      return;
    }
    if (Number.isNaN(interest) || interest < 0) {
      showToast('Zinssatz ungültig.', 'error');
      return;
    }
    const nextInterest = Math.round(interest * 100) / 100;
    const nextMonthly = Math.round(monthly * 100) / 100;
    const nextTotal = Math.round(total * 100) / 100;
    const parsedProperty = newDebtKind === 'house' ? parseDebtPropertyValueInput() : undefined;
    if (parsedProperty === 'invalid') {
      showToast('Marktwert der Immobilie ungültig.', 'error');
      return;
    }
    if (editingDebtId != null) {
      setDebts((prev) =>
        prev.map((d) =>
          d.id !== editingDebtId
            ? d
            : {
                ...d,
                name,
                total: nextTotal,
                remaining: Math.min(d.remaining, nextTotal),
                interest: nextInterest,
                monthly: nextMonthly,
                kind: newDebtKind,
                propertyValue: newDebtKind === 'house' ? parsedProperty : undefined,
              },
        ),
      );
      showToast(`Schuld „${name}“ aktualisiert.`, 'success');
      resetDebtForm();
      return;
    }
    const id = debts.length ? Math.max(...debts.map((d) => d.id)) + 1 : 1;
    setDebts((prev) => [
      ...prev,
      {
        id,
        name,
        total: nextTotal,
        remaining: nextTotal,
        interest: nextInterest,
        monthly: nextMonthly,
        kind: newDebtKind,
        ...(newDebtKind === 'house' && parsedProperty != null ? { propertyValue: parsedProperty } : {}),
      },
    ]);
    showToast(`Schuld „${name}“ aufgenommen! ⚡`);
    resetDebtForm();
  };

  const submitAuth = async () => {
    setAuthError('');
    if (!BILLING_API) {
      setAuthError(
        import.meta.env.DEV
          ? 'Billing-Server nicht erreichbar. Zweites Terminal: npm run dev:billing — oder VITE_BILLING_API_URL in .env.local setzen.'
          : 'Backend-URL fehlt. Auf Vercel Environment Variable VITE_BILLING_API_URL = deine Railway-URL setzen und neu deployen.',
      );
      return;
    }
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const email = authForm.email.trim();
      const password = authForm.password;
      const affiliateCode =
        localStorage.getItem('allwin.affiliate') ||
        new URLSearchParams(window.location.search).get('ref') ||
        '';
      const payload =
        authMode === 'login'
          ? { email, password }
          : {
              name: authForm.name.trim() || email.split('@')[0] || 'User',
              email,
              password,
              ...(affiliateCode.trim() ? { affiliateCode: affiliateCode.trim() } : {}),
            };
      const res = await fetch(`${BILLING_API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error || 'Anmeldung fehlgeschlagen.');
        return;
      }
      setAuthToken(data.token);
      setAuthUser(data.user);
      showToast(`Willkommen, ${data.user?.name || 'User'}!`);
    } catch {
      setAuthError(
        `Server nicht erreichbar (${BILLING_API}). Railway-URL im Browser testen: ${BILLING_API}/api/auth/me — Service aktiv? VITE_BILLING_API_URL auf Vercel = https://…`,
      );
    }
  };

  const finishSocialAuth = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    setAuthError('');
    showToast(`Willkommen, ${user?.name || 'Champion'}!`);
  };

  const handleGoogleToken = async (idToken: string) => {
    try {
      const res = await fetch(`${BILLING_API}/api/auth/oauth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error || 'Google Login fehlgeschlagen.');
        return;
      }
      finishSocialAuth(data.token, data.user);
    } catch {
      setAuthError(
        'Google Login nicht erreichbar. Billing mit npm run dev:billing starten. Bei Zugriff über WLAN-/Netzwerk-IP: VITE_BILLING_API_URL in .env.local leer lassen (Proxy /api).',
      );
    }
  };

  const startGoogleRedirectLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google Client ID fehlt.');
      return;
    }
    const redirectUri = window.location.origin;
    const nonce = Math.random().toString(36).slice(2);
    sessionStorage.setItem('allwin.google.nonce', nonce);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'id_token');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('prompt', 'select_account');
    window.location.href = url.toString();
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      const apple = (window as any).AppleID;
      if (!apple?.auth) {
        setAuthError('Apple Sign-In Script nicht geladen.');
        setAppleLoading(false);
        return;
      }
      apple.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: APPLE_REDIRECT_URI,
        usePopup: true,
      });
      const response = await apple.auth.signIn();
      const idToken = response?.authorization?.id_token;
      if (!idToken) {
        setAuthError('Apple Login abgebrochen.');
        setAppleLoading(false);
        return;
      }
      const fullName = [response?.user?.name?.firstName, response?.user?.name?.lastName].filter(Boolean).join(' ');
      const res = await fetch(`${BILLING_API}/api/auth/oauth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.error || 'Apple Login fehlgeschlagen.');
        setAppleLoading(false);
        return;
      }
      finishSocialAuth(data.token, data.user);
    } catch {
      setAuthError('Apple Login fehlgeschlagen.');
    } finally {
      setAppleLoading(false);
    }
  };

  const logout = () => {
    setAuthUser(null);
    setAuthToken('');
    setAuthForm({ name: '', email: '', password: '' });
    setAuthError('');
    setAuthGate('welcome');
    setCloudUserStateReady(false);
    setHydrating(false);
    setOnboardingDone(false);
    cloudOnboardingHydratedRef.current = false;
    cloudPersistReadyRef.current = false;
  };

  const saveProfileName = async () => {
    if (!authToken || !authUser) return;
    const name = profileNameDraft.trim();
    if (name.length < 2) {
      showToast('Name zu kurz (min. 2 Zeichen).', 'error');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch(`${BILLING_API}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || 'Name konnte nicht gespeichert werden.', 'error');
        return;
      }
      setAuthUser(data.user);
      showToast('Nutzername aktualisiert ✅');
    } catch {
      showToast('Profil-Update fehlgeschlagen.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const submitFeedback = async () => {
    if (!authToken || !BILLING_API) {
      showToast('Bitte einloggen, um Feedback zu senden.', 'error');
      return;
    }
    const message = feedbackMessage.trim();
    if (message.length < 8) {
      showToast('Bitte etwas ausführlicher schreiben (min. 8 Zeichen).', 'error');
      return;
    }
    setFeedbackSending(true);
    try {
      const res = await fetch(`${BILLING_API}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ kind: feedbackKind, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(typeof data?.error === 'string' ? data.error : 'Feedback konnte nicht gesendet werden.', 'error');
        return;
      }
      setFeedbackMessage('');
      showToast('Danke! Dein Feedback ist angekommen. 🙏');
    } catch {
      showToast('Server nicht erreichbar — bitte später erneut versuchen.', 'error');
    } finally {
      setFeedbackSending(false);
    }
  };

  const applyRedeemCode = () => {
    const normalized = redeemCode.trim().toUpperCase();
    if (!normalized) return;
    if (normalized === 'CLEVERPRO' || normalized === 'ALLWINPRO') {
      setSub((prev) => ({ ...prev, tier: 'pro' }));
      showToast(`Code eingelöst: ${PRICING.pro.name} freigeschaltet! 🚀`);
      setRedeemCode('');
      return;
    }
    if (normalized === 'CLEVERELITE' || normalized === 'ALLWINELITE') {
      setSub((prev) => ({ ...prev, tier: 'elite' }));
      showToast(`Code eingelöst: ${PRICING.elite.name} freigeschaltet! 👑`);
      setRedeemCode('');
      return;
    }
    showToast('Ungültiger Code. Bitte prüfen.', 'error');
  };

  useEffect(() => {
    if (authUser || authGate !== 'auth' || !GOOGLE_CLIENT_ID) return;
    const scriptId = 'google-identity-script';
    const renderGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleBtnRef.current) {
        setGoogleUiFailed(true);
        setGoogleUiReady(false);
        return;
      }
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          if (response?.credential) void handleGoogleToken(response.credential);
        },
      });
      googleBtnRef.current.innerHTML = '';
      google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 320,
      });
      setGoogleUiReady(true);
      setGoogleUiFailed(false);
    };

    if (document.getElementById(scriptId)) {
      renderGoogle();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogle;
    script.onerror = () => {
      setGoogleUiFailed(true);
      setGoogleUiReady(false);
    };
    document.head.appendChild(script);
  }, [GOOGLE_CLIENT_ID, authUser, authGate]);

  useEffect(() => {
    if (authUser || authGate !== 'auth') return;
    const hash = window.location.hash || '';
    if (!hash.includes('id_token=')) return;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const idToken = params.get('id_token');
    if (!idToken) return;
    window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}`);
    void handleGoogleToken(idToken);
  }, [authUser, authGate]);

  const reloadGoogleUi = () => {
    const scriptId = 'google-identity-script';
    const old = document.getElementById(scriptId);
    if (old) old.remove();
    setGoogleUiReady(false);
    setGoogleUiFailed(false);
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleBtnRef.current) {
        setGoogleUiFailed(true);
        return;
      }
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          if (response?.credential) void handleGoogleToken(response.credential);
        },
      });
      googleBtnRef.current.innerHTML = '';
      google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 320,
      });
      setGoogleUiReady(true);
      setGoogleUiFailed(false);
    };
    script.onerror = () => setGoogleUiFailed(true);
    document.head.appendChild(script);
  };

  useEffect(() => {
    if (authUser || authGate !== 'auth' || !APPLE_CLIENT_ID) return;
    const scriptId = 'apple-signin-script';
    if (document.getElementById(scriptId)) {
      setAppleReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => setAppleReady(true);
    script.onerror = () => setAppleReady(false);
    document.head.appendChild(script);
  }, [APPLE_CLIENT_ID, authUser, authGate]);

  const changePlan = async (tier: SubscriptionTier) => {
    if (tier === 'free') {
      setSub((prev) => ({ ...prev, tier: 'free' }));
      showToast(`Auf ${PRICING.free.name} umgestellt.`, 'success');
      return;
    }
    setUpgradeLoading(true);
    try {
      const res = await fetch(`${BILLING_API}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cycle: sub.cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        showToast(data?.error || 'Checkout konnte nicht gestartet werden.', 'error');
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast('Billing-Server nicht erreichbar.', 'error');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const S = {
    app: {
      minHeight: '100vh',
      backgroundColor: awBg.appFallback,
      backgroundImage: awBg.app,
      color: '#e6edf3',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      maxWidth: 430,
      margin: '0 auto',
      position: 'relative' as const,
      paddingBottom: 'calc(152px + env(safe-area-inset-bottom, 0px))',
    },
    header: { padding: '24px 20px 12px', background: awBg.header },
    logo: { fontSize: 26, fontWeight: 900, letterSpacing: -1, color: '#fff' },
    logoAccent: { color: '#2563eb' },
    sub: { fontSize: 12, color: '#7d8590', marginTop: 2 },
    card: { background: awBg.card, borderRadius: 16, padding: 18, marginBottom: 12, border: `1px solid ${awBg.cardBorder}` },
    cardAccent: (pos: boolean) => ({
      background: pos ? 'linear-gradient(135deg,#101e38,#173562)' : 'linear-gradient(135deg,#2e0a0a,#3d0d0d)',
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      border: `1px solid ${pos ? '#2563eb33' : '#ff444433'}`,
    }),
    section: { padding: '0 16px' },
    label: { fontSize: 11, color: '#7d8590', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6 },
    bigNum: { fontSize: 32, fontWeight: 800, letterSpacing: -1 },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    input: { width: '100%', background: awBg.field, border: `1px solid ${awBg.line}`, borderRadius: 10, padding: '10px 14px', color: '#e6edf3', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' },
    select: { width: '100%', background: awBg.field, border: `1px solid ${awBg.line}`, borderRadius: 10, padding: '10px 14px', color: '#e6edf3', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none', appearance: 'none' as const },
    btn: (col?: string) => ({
      background: col || '#2563eb',
      color: col ? '#fff' : '#0d1117',
      border: col ? '1px solid #ffffff22' : '1px solid #00f5c233',
      borderRadius: 10,
      padding: '12px 20px',
      fontWeight: 800,
      fontSize: 14,
      cursor: 'pointer',
      width: '100%',
      marginTop: 8,
      boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
    }),
    chip: (active: boolean) => ({
      padding: '8px 13px',
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      border: `1px solid ${active ? '#2563eb' : '#4d5560'}`,
      background: active ? '#2563eb2e' : awBg.chipOff,
      color: active ? '#93c5fd' : '#d0d7de',
      boxShadow: active ? '0 0 0 1px #2563eb55 inset, 0 6px 14px rgba(37, 99, 235, 0.18)' : '0 2px 8px rgba(0,0,0,0.25)',
    }),
    debtCard: { background: awBg.card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${awBg.cardBorder}` },
    txRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${awBg.cardBorder}` },
    marketRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' },
    toast: (type: 'success' | 'error' | 'level') => ({
      position: 'fixed' as const,
      top: 'max(12px, env(safe-area-inset-top, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(400px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      boxSizing: 'border-box' as const,
      background: type === 'level' ? '#1f6feb' : type === 'error' ? '#cf222e' : '#2563eb',
      color: type === 'level' ? '#fff' : type === 'error' ? '#fff' : '#f0f7ff',
      padding: '12px 16px',
      borderRadius: type === 'error' ? 14 : 12,
      fontWeight: 700,
      fontSize: 13,
      lineHeight: 1.45,
      zIndex: 999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      whiteSpace: 'normal' as const,
      overflowWrap: 'anywhere' as const,
      textAlign: 'center' as const,
    }),
    tabBar: {
      position: 'fixed' as const,
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      width: 'calc(100% - 28px)',
      maxWidth: 392,
      display: 'flex',
      alignItems: 'center',
      padding: '8px 10px',
      zIndex: 100,
      borderRadius: 9999,
      background: awBg.dock,
      WebkitBackdropFilter: 'blur(22px)',
      backdropFilter: 'blur(22px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45), 0 2px 12px rgba(0, 0, 0, 0.25)',
    },
    tabItem: (active: boolean) => ({
      flex: 1,
      padding: '10px 4px 8px',
      textAlign: 'center' as const,
      cursor: 'pointer',
      fontSize: 9,
      fontWeight: 700,
      color: active ? '#93c5fd' : '#9da7b3',
      background: active ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
      border: 'none',
      borderRadius: 999,
      margin: '0 2px',
    }),
    tabIcon: { fontSize: 20, display: 'block', marginBottom: 2 },
  };

  const orderSymLedger = useMemo(() => {
    const sym = tradeSym;
    const fifo = fifoSharesAndCost(portfolioTrades, sym);
    const buys = portfolioTrades.filter((t) => t.sym === sym && t.kind === 'buy');
    const buysNewestFirst = [...buys].slice(0, 14);
    const livePx = market.find((m) => m.sym === sym)?.price ?? 0;
    const held = portfolioShares[sym] ?? 0;
    return { fifo, buysNewestFirst, livePx, held };
  }, [tradeSym, portfolioTrades, market, portfolioShares]);

  const renderInstrumentAddForm = (onCancel: () => void, opts?: { watchlistOnly?: boolean }) => (
    <div
      style={{
        marginTop: 8,
        marginBottom: 4,
        padding: '12px',
        borderRadius: 12,
        background: awBg.hole,
        border: `1px solid ${awBg.line}`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: '#c9d1d9', marginBottom: 8 }}>Neues Instrument</div>
      {wlAddSym.trim() ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.22)',
          }}
        >
          <MarketAssetIcon item={provisionalLogoFields(wlAddSym, wlAddKind, wlAddName)} size={44} borderRadius={10} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#7d8590', fontWeight: 600, marginBottom: 2 }}>Vorschau</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#e6edf3' }}>
              {wlAddName.trim() || sanitizeWatchlistSymbol(wlAddSym) || wlAddSym.trim()}
            </div>
            <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
              {wlAddKind === 'crypto' ? 'Krypto' : 'Aktie / ETF'}
              {sanitizeWatchlistSymbol(wlAddSym) ? ` · ${sanitizeWatchlistSymbol(wlAddSym)}` : ''}
            </div>
          </div>
        </div>
      ) : null}
      <div style={{ fontSize: 10, color: '#7d8590', marginBottom: 10, lineHeight: 1.45 }}>
        {opts?.watchlistOnly ? (
          <>
            Nur Beobachtung unter <strong style={{ color: '#c9d1d9' }}>Live Marktdaten</strong> — Live-Kurs vom Server, kein Eintrag unter
            Portfolio Power / Order. <strong style={{ color: '#c9d1d9' }}>Börsen-Kürzel oder ISIN</strong> — ISIN wird automatisch
            zum Kürzel + Namen aufgelöst.
          </>
        ) : (
          <>
            <strong style={{ color: '#c9d1d9' }}>Börsen-Kürzel oder ISIN</strong> + Art wählen (z. B.{' '}
            <strong style={{ color: '#c9d1d9' }}>AAPL</strong>, <strong style={{ color: '#c9d1d9' }}>SAP.DE</strong>, oder ISIN vom
            Depotauszug). ISIN wird automatisch zum Kürzel und Anzeigenamen aufgelöst.
          </>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 90px', minWidth: 80 }}>
          <label style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Börsen-Kürzel oder ISIN
          </label>
          <input
            style={{ ...S.input, marginTop: 0 }}
            placeholder="z. B. AAPL, SAP.DE oder ISIN"
            autoCapitalize="characters"
            value={wlAddSym}
            onChange={(e) => setWlAddSym(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 100px', minWidth: 90 }}>
          <label style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Anzeigename (optional)
          </label>
          <input
            style={{ ...S.input, marginTop: 0 }}
            placeholder="z. B. Apple"
            value={wlAddName}
            onChange={(e) => setWlAddName(e.target.value)}
          />
        </div>
        <select
          style={{ ...S.select, marginTop: 0, flex: '0 1 130px', minWidth: 110 }}
          value={wlAddKind}
          onChange={(e) => setWlAddKind(e.target.value === 'crypto' ? 'crypto' : 'stock')}
        >
          <option value="stock">Aktie / ETF</option>
          <option value="crypto">Krypto</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' as const }}>
        <button
          type="button"
          style={{ ...S.btn('#2563eb'), marginTop: 0, opacity: wlAddLoading ? 0.7 : 1 }}
          disabled={wlAddLoading}
          onClick={() => void addWatchlistInstrument({ watchlistOnly: opts?.watchlistOnly === true })}
        >
          {wlAddLoading ? 'Wird aufgelöst…' : 'Hinzufügen'}
        </button>
        <button type="button" style={{ ...S.chip(false), marginTop: 0 }} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );

  const renderPortfolioAllocation = (showTrading: boolean) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...S.label, fontSize: 11, marginBottom: 8, color: '#8b949e' }}>📍 Investiert nach Watchlist</div>
      <div style={{ fontSize: 10, color: '#7d8590', marginBottom: 10, lineHeight: 1.45 }}>
        Eigene Aktien/Krypto: <strong style={{ color: '#c9d1d9' }}>✕</strong> entfernt das Symbol komplett (auch Live). Standardtitel der App: <strong style={{ color: '#c9d1d9' }}>✕</strong> nur bei <strong style={{ color: '#c9d1d9' }}>0 Stk</strong> — blendet sie unter Portfolio und Order aus (Live bleibt). Zurück: „Alle Standard-Titel wieder einblenden“.
      </div>
      {tradableMarket.map((m) => {
        const stk = portfolioShares[m.sym] ?? 0;
        const val = stk * m.price;
        const w = portfolioAlloc[m.sym] ?? 0;
        const pct = w * 100;
        const logoSource = m;
        const display = instrumentDisplayLines(instrumentMetaForSym(m.sym, market, watchlistExtras));
        return (
          <div key={m.sym} style={{ marginBottom: 10 }}>
            <div style={{ ...S.row, marginBottom: 4, gap: 8, alignItems: 'center' as const }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <MarketAssetIcon item={logoSource} size={32} borderRadius={8} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>{display.title}</div>
                  {display.subtitle ? (
                    <div style={{ fontSize: 10, color: '#7d8590', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {display.subtitle}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
                    Kurs <strong style={{ color: '#c9d1d9' }}>{fmt(m.price)}</strong>/Stk ·{' '}
                    <span style={{ color: m.change >= 0 ? '#2563eb' : '#ff7b7b', fontWeight: 600 }}>
                      {m.change >= 0 ? '+' : ''}
                      {m.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#a855f7' }}>{fmt(val)}</div>
                  <div style={{ fontSize: 11, color: '#7d8590' }}>
                    {fmtStk(stk)} Stk · {pct.toFixed(1)} %
                  </div>
                </div>
                {!BASE_SYM_SET.has(m.sym) ? (
                  <button
                    type="button"
                    aria-label={`${m.sym} aus Portfolio und Listen entfernen`}
                    title="Titel entfernen"
                    onClick={() => removeWatchlistInstrument(m.sym)}
                    style={{
                      flexShrink: 0,
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: `1px solid ${awBg.line}`,
                      background: '#24242c',
                      color: '#8b949e',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ✕
                  </button>
                ) : stk <= 1e-12 ? (
                  <button
                    type="button"
                    aria-label={`${m.sym} bei 0 Stk aus Portfolio ausblenden`}
                    title="Aus Portfolio ausblenden (Live bleibt)"
                    onClick={() => excludeBaselineFromPortfolioPower(m.sym)}
                    style={{
                      flexShrink: 0,
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: `1px solid ${awBg.line}`,
                      background: '#24242c',
                      color: '#8b949e',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ✕
                  </button>
                ) : (
                  <div style={{ width: 34, flexShrink: 0 }} aria-hidden />
                )}
              </div>
            </div>
            <Bar pct={pct} color="#7c3aed" />
          </div>
        );
      })}
      {portfolioExcludedBaseSyms.length > 0 ? (
        <button
          type="button"
          style={{ ...S.chip(false), marginTop: 8, marginBottom: 6, fontSize: 11, fontWeight: 600 }}
          onClick={() => {
            setPortfolioExcludedBaseSyms([]);
            showToast('Standard-Titel wieder in Portfolio Power & Order sichtbar.');
          }}
        >
          Alle Standard-Titel wieder einblenden
        </button>
      ) : null}
      <div style={{ fontSize: 10, color: '#7d8590', marginTop: 6, lineHeight: 1.45 }}>
        {showTrading ? (
          <>
            Orders in <span style={{ fontWeight: 700, color: '#e6edf3' }}>Stückzahl</span>. Kauf zieht vom <span style={{ fontWeight: 700, color: '#e6edf3' }}>Cash Depot</span> zum Marktkurs; Verkauf bucht den Erlös ins Cash Depot. Portfolio in € = Positionen + Cash Depot.
          </>
        ) : (
          <>
            Nur Übersicht. <span style={{ fontWeight: 700, color: '#a855f7' }}>Nachkauf & Verkauf</span> findest du im Tab „LevelUp“.
          </>
        )}
      </div>

      {showTrading && (
        <>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${awBg.cardBorder}` }}>
            <div style={{ ...S.label, fontSize: 11, marginBottom: 8, color: '#8b949e' }}>🛒 Order in Stückzahl</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" style={{ ...S.chip(tradeMode === 'buy'), flex: 1, marginTop: 0 }} onClick={() => setTradeMode('buy')}>
                🟢 Kaufen / Nachkauf
              </button>
              <button type="button" style={{ ...S.chip(tradeMode === 'sell'), flex: 1, marginTop: 0 }} onClick={() => setTradeMode('sell')}>
                🔴 Verkaufen
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, lineHeight: 1.4 }}>
              Cash Depot: {fmt(portfolioBrokerCash)}
              {!orderInstrumentAddOpen &&
                tradeMode === 'buy' &&
                (() => {
                  const p = market.find((x) => x.sym === tradeSym)?.price ?? 0;
                  if (p > 0 && portfolioBrokerCash > 0) {
                    return ` · max. ca. ${fmtStk(portfolioBrokerCash / p)} Stk bei ${tradeSym}`;
                  }
                  if (p > 0 && portfolioBrokerCash <= 0) return ' · keine Kaufkraft ohne Cash';
                  return '';
                })()}
            </div>
            {!orderInstrumentAddOpen && (() => {
              const tradeRow = market.find((m) => m.sym === tradeSym);
              const tradeDisplay = instrumentDisplayLines(instrumentMetaForSym(tradeSym, market, watchlistExtras));
              if (!tradeRow) return null;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: awBg.hole,
                    border: `1px solid ${awBg.line}`,
                  }}
                >
                  <MarketAssetIcon item={tradeRow} size={44} borderRadius={10} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#e6edf3' }}>{tradeDisplay.title}</div>
                    {tradeDisplay.subtitle ? (
                      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{tradeDisplay.subtitle}</div>
                    ) : null}
                    <div style={{ fontSize: 11, color: '#7d8590', marginTop: 4 }}>
                      Live-Kurs{' '}
                      <strong style={{ color: '#c9d1d9' }}>
                        {orderSymLedger.livePx > 0 ? fmt(orderSymLedger.livePx) : '…'}
                      </strong>
                      /Stk
                    </div>
                  </div>
                </div>
              );
            })()}
            {!orderInstrumentAddOpen ? (
              <select
                style={{ ...S.select, marginBottom: 8 }}
                value={tradeSym}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === ADD_INSTRUMENT_SELECT_VALUE) {
                    setOrderInstrumentAddOpen(true);
                    setLiveMarketAddOpen(false);
                    return;
                  }
                  setOrderInstrumentAddOpen(false);
                  setTradeSym(v);
                }}
              >
                {tradableMarket.map((m) => {
                  const display = instrumentDisplayLines(instrumentMetaForSym(m.sym, market, watchlistExtras));
                  return (
                    <option key={m.sym} value={m.sym}>
                      {display.title}
                      {display.subtitle ? ` · ${display.subtitle}` : ''}
                    </option>
                  );
                })}
                <option value={ADD_INSTRUMENT_SELECT_VALUE} style={{ fontWeight: 700 }}>
                  + Neue Aktie / Krypto…
                </option>
              </select>
            ) : (
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10, lineHeight: 1.5 }}>
                <strong style={{ color: '#c9d1d9' }}>Neues Instrument anlegen.</strong> Börsen-Kürzel oder ISIN — wird automatisch
                benannt. Danach wieder normal handeln; „Abbrechen“ = zurück zur Titelwahl.
              </div>
            )}
            {orderInstrumentAddOpen && !levelUpLocked && !liveMarketAddOpen ? (
              renderInstrumentAddForm(() => setOrderInstrumentAddOpen(false))
            ) : null}
            {!orderInstrumentAddOpen ? (
            <div
              style={{
                marginBottom: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: awBg.hole,
                border: `1px solid ${awBg.line}`,
              }}
            >
              <div style={{ ...S.label, fontSize: 10, marginBottom: 6, color: '#8b949e' }}>📒 Zu {tradeSym}</div>
              <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.55 }}>
                <div>
                  <span style={{ color: '#7d8590' }}>Aktuell im Depot: </span>
                  <strong>{fmtStk(orderSymLedger.held)}</strong> Stk
                </div>
                <div>
                  <span style={{ color: '#7d8590' }}>Live-Kurs: </span>
                  <strong>{fmt(orderSymLedger.livePx)}</strong> je Stück
                </div>
                {orderSymLedger.fifo.avgPerShare != null ? (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: '#7d8590' }}>Ø dein Kaufpreis (geschätzt aus Orders): </span>
                    <strong>{fmt(orderSymLedger.fifo.avgPerShare)}</strong> je Stück
                    <span style={{ color: '#7d8590' }}>
                      {' '}
                      · gebuchte Restkostenbasis ~ <strong>{fmt(orderSymLedger.fifo.costEur)}</strong>
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6 }}>
                    Ø Kaufpreis erst nach Buchungen mit gespeichertem Kurspreis — neue Orders ab jetzt enthalten EUR/Stück.
                  </div>
                )}
              </div>
              {orderSymLedger.buysNewestFirst.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginTop: 10, marginBottom: 6 }}>Deine Käufe</div>
                  <div style={{ maxHeight: 140, overflowY: 'auto' as const }}>
                    {orderSymLedger.buysNewestFirst.map((t) => {
                      const eu = tradeOrderEur(t);
                      const ppu = typeof t.pricePerShareEur === 'number' ? t.pricePerShareEur : eu != null && t.amount > 0 ? eu / t.amount : null;
                      return (
                        <div
                          key={`buy-${t.id}`}
                          style={{
                            fontSize: 11,
                            padding: '6px 0',
                            borderBottom: `1px solid ${awBg.cardBorder}`,
                            color: '#c9d1d9',
                          }}
                        >
                          <strong>{fmtStk(t.amount)}</strong> Stk gekauft
                          {ppu != null ? (
                            <>
                              {' · Kaufpreis'}{' '}
                              <strong>{fmt(ppu)}</strong>/Stk
                            </>
                          ) : null}
                          {eu != null ? (
                            <>
                              {' · Summe '}
                              <strong>{fmt(eu)}</strong>
                            </>
                          ) : (
                            <> · Kurspreis nicht gespeichert</>
                          )}
                          <div style={{ fontSize: 10, color: '#7d8590', marginTop: 2 }}>{t.at}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 8 }}>Noch keine Käufe über „Order ausführen“ für dieses Symbol.</div>
              )}
            </div>
            ) : null}
            {!orderInstrumentAddOpen ? (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' as const, marginBottom: 8 }}>
                  <input
                    style={{ ...S.input, flex: '1 1 120px', marginTop: 0, marginBottom: 0, minWidth: 0 }}
                    inputMode="decimal"
                    placeholder="Stückzahl (z. B. 10 oder 0,25)"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                  />
                  {tradeMode === 'sell' && orderSymLedger.held > 0 ? (
                    <button
                      type="button"
                      title="Gesamten Depotbestand zu diesem Titel verkaufen"
                      style={{
                        ...S.chip(false),
                        marginTop: 0,
                        flex: '0 0 auto',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap' as const,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#ff7b7b',
                        border: '1px solid rgba(207, 34, 46, 0.45)',
                        background: 'rgba(207, 34, 46, 0.12)',
                      }}
                      onClick={() => submitPortfolioTrade({ sellAll: true })}
                    >
                      Alles verkaufen
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                  <input
                    style={{ ...S.input, flex: '1 1 100px', marginTop: 0, marginBottom: 0, minWidth: 0 }}
                    inputMode="decimal"
                    placeholder="Gebühr € (optional)"
                    value={tradeFeeStr}
                    onChange={(e) => setTradeFeeStr(normalizeMoneyDecimalInput(e.target.value))}
                  />
                  <input
                    style={{ ...S.input, flex: '1 1 100px', marginTop: 0, marginBottom: 0, minWidth: 0 }}
                    inputMode="decimal"
                    placeholder="Steuer € (optional)"
                    value={tradeTaxStr}
                    onChange={(e) => setTradeTaxStr(normalizeMoneyDecimalInput(e.target.value))}
                  />
                </div>
                <div style={{ fontSize: 10, color: '#7d8590', marginBottom: 8, lineHeight: 1.4 }}>
                  Grobe Planung: Ordergebühr und Steuer manuell — z. B. 1,00 oder 26,38. Kauf: zusätzlich zum Kurswert; Verkauf: vom Erlös abgezogen.
                </div>
                <button
                  type="button"
                  style={{ ...S.btn(tradeMode === 'sell' ? '#cf222e' : undefined), marginTop: 0 }}
                  onClick={() => submitPortfolioTrade()}
                >
                  {tradeMode === 'buy' ? '✅ Order ausführen (Kauf)' : '✅ Order ausführen (Verkauf)'}
                </button>
              </>
            ) : null}
          </div>

          {portfolioTrades.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setLevelUpTradesOpen((o) => !o)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  marginBottom: levelUpTradesOpen ? 8 : 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ ...S.label, fontSize: 11, marginBottom: 0, color: '#8b949e' }}>
                  📒 Depot-Buchungen ({portfolioTrades.length})
                </div>
                <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700 }}>{levelUpTradesOpen ? '▼' : '▶'}</span>
              </button>
              {levelUpTradesOpen && (
                <>
                  <div style={{ fontSize: 10, color: '#7d8590', marginBottom: 8, lineHeight: 1.45 }}>
                    Alle Käufe/Verkäufe — prüfen, korrigieren oder löschen. Cash Depot und Bestand werden dabei angepasst.
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '4px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#7d8590',
                      padding: '0 4px 6px',
                      borderBottom: `1px solid ${awBg.cardBorder}`,
                    }}
                  >
                    <span>Buchung</span>
                    <span style={{ textAlign: 'right' }}>Aktion</span>
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' as const, WebkitOverflowScrolling: 'touch' }}>
                    {portfolioTrades.map((t) => {
                      const eu = tradeOrderEur(t);
                      const ppu =
                        typeof t.pricePerShareEur === 'number'
                          ? t.pricePerShareEur
                          : eu != null && t.amount > 0
                            ? eu / t.amount
                            : null;
                      const isEditing = editingTradeId === t.id;
                      return (
                        <div
                          key={t.id}
                          style={{
                            padding: '10px 4px',
                            borderBottom: `1px solid ${awBg.cardBorder}`,
                            background: isEditing ? 'rgba(88, 166, 255, 0.06)' : 'transparent',
                          }}
                        >
                          {!isEditing ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontWeight: 800, fontSize: 13, color: t.kind === 'buy' ? '#58a6ff' : '#ff7b7b' }}>
                                    {t.kind === 'buy' ? '🟢 Kauf' : '🔴 Verkauf'} · {t.sym}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#e6edf3', marginTop: 4, lineHeight: 1.45 }}>
                                    <strong>{fmtStk(t.amount)}</strong> Stk
                                    {ppu != null ? (
                                      <>
                                        {' '}
                                        à <strong>{fmt(ppu)}</strong>
                                      </>
                                    ) : null}
                                    {eu != null ? (
                                      <>
                                        {' '}
                                        · Summe <strong>{fmt(eu)}</strong>
                                      </>
                                    ) : null}
                                    {(t.feeEur ?? 0) + (t.taxEur ?? 0) > 0 ? (
                                      <span style={{ color: '#8b949e' }}>
                                        {' '}
                                        · Gebühr/Steuer {fmt((t.feeEur ?? 0) + (t.taxEur ?? 0))}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#7d8590', marginTop: 4 }}>{t.at}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    style={{ ...S.chip(false), marginTop: 0, padding: '6px 10px', fontSize: 11, fontWeight: 700 }}
                                    onClick={() => startEditPortfolioTrade(t)}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      ...S.chip(false),
                                      marginTop: 0,
                                      padding: '6px 10px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: '#ff7b7b',
                                      border: '1px solid rgba(207,34,46,0.35)',
                                    }}
                                    onClick={() => deletePortfolioTrade(t.id)}
                                  >
                                    🗑
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff' }}>
                                Buchung bearbeiten — {t.kind === 'buy' ? 'Kauf' : 'Verkauf'} {t.sym}
                              </div>
                              <input
                                style={{ ...S.input, marginTop: 0, marginBottom: 0 }}
                                inputMode="decimal"
                                placeholder="Stückzahl"
                                value={tradeEditAmount}
                                onChange={(e) => setTradeEditAmount(e.target.value)}
                              />
                              <input
                                style={{ ...S.input, marginTop: 0, marginBottom: 0 }}
                                inputMode="decimal"
                                placeholder="Kurs je Stück (€)"
                                value={tradeEditPrice}
                                onChange={(e) => setTradeEditPrice(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  style={{ ...S.input, flex: 1, marginTop: 0, marginBottom: 0 }}
                                  inputMode="decimal"
                                  placeholder="Gebühr €"
                                  value={tradeEditFeeStr}
                                  onChange={(e) => setTradeEditFeeStr(normalizeMoneyDecimalInput(e.target.value))}
                                />
                                <input
                                  style={{ ...S.input, flex: 1, marginTop: 0, marginBottom: 0 }}
                                  inputMode="decimal"
                                  placeholder="Steuer €"
                                  value={tradeEditTaxStr}
                                  onChange={(e) => setTradeEditTaxStr(normalizeMoneyDecimalInput(e.target.value))}
                                />
                              </div>
                              <input
                                style={{ ...S.input, marginTop: 0, marginBottom: 0 }}
                                placeholder="Datum / Notiz"
                                value={tradeEditDate}
                                onChange={(e) => setTradeEditDate(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" style={{ ...S.btn(), flex: 1, marginTop: 0 }} onClick={saveEditedPortfolioTrade}>
                                  Speichern
                                </button>
                                <button type="button" style={{ ...S.chip(false), flex: 1, marginTop: 0 }} onClick={cancelEditPortfolioTrade}>
                                  Abbrechen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const tabs = [
    { id: 'dashboard', icon: '🏠', label: 'Home' },
    { id: 'transactions', icon: '💸', label: 'Money' },
    { id: 'charts', icon: '📈', label: 'Übersicht' },
    { id: 'debts', icon: '⚡', label: 'Boost' },
    { id: 'invest', icon: '📊', label: 'LevelUp' },
    { id: 'profile', icon: '👤', label: 'Mehr' },
  ];
  const hasOpenDebts = useMemo(() => debts.some((d) => d.remaining > 0), [debts]);
  const tabsVisible = useMemo(
    () =>
      tabs
        .filter((t) => !(t.id === 'debts' && !hasOpenDebts)),
    [hasOpenDebts],
  );

  const appTourSteps = useMemo(
    () =>
      APP_TOUR_STEPS.filter((s) => {
        if (s.requiresOpenDebts && !hasOpenDebts) return false;
        if (s.requiresLevelUpUnlocked && levelUpLocked) return false;
        return true;
      }),
    [hasOpenDebts, levelUpLocked],
  );

  useEffect(() => {
    if (levelUpLocked && tab === 'invest') setTab('dashboard');
  }, [levelUpLocked, tab]);

  useEffect(() => {
    if (!hasOpenDebts && tab === 'debts' && !debtAddOpen) setTab('dashboard');
  }, [hasOpenDebts, tab, debtAddOpen]);

  const renderDashboard = () => (
    <div style={S.section}>
      <div data-tour="home-saldo" style={S.cardAccent(saldo >= 0)}>
        <div style={S.label}>Monat in Zahlen</div>
        <div style={{ fontSize: 11, color: '#7d8590', marginTop: 2 }}>
          {MONTHS[calMonth0]} {reportYear}
        </div>
        <div style={{ ...S.bigNum, color: saldo >= 0 ? '#2563eb' : '#ff7b7b', marginTop: 6 }}>{fmt(saldo)}</div>
        <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4 }}>{saldo >= 0 ? 'Plus im Monat' : 'Minus im Monat'}</div>
        <div style={{ ...S.row, marginTop: 12 }}>
          <div>
            <div style={S.label}>Einnahmen</div>
            <div style={{ color: '#2563eb', fontWeight: 700 }}>{fmt(moneyThisMonth.einnahmen)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={S.label}>Ausgaben</div>
            <div style={{ color: '#ff7b7b', fontWeight: 700 }}>{fmt(moneyThisMonth.ausgaben)}</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 18px',
            marginTop: 12,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('transactions')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 12,
              color: '#5b93ff',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            In Money bearbeiten
          </button>
          <button
            type="button"
            onClick={restartOnboarding}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 12,
              color: '#5b93ff',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Onboarding wiederholen
          </button>
        </div>
      </div>

      <div data-tour="home-notgroschen" style={{ ...S.card, position: 'relative', paddingTop: 14 }}>
        <div ref={notgroschenHomeMenuRef} style={{ position: 'absolute', top: 10, right: 8, zIndex: 2 }}>
          <button
            type="button"
            aria-expanded={notgroschenHomeMenuOpen}
            aria-haspopup="menu"
            aria-label="Notgroschen-Optionen"
            onClick={() => setNotgroschenHomeMenuOpen((o) => !o)}
            style={{
              background: '#24242c',
              border: `1px solid ${awBg.line}`,
              borderRadius: 8,
              width: 36,
              height: 32,
              cursor: 'pointer',
              color: '#e6edf3',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⋮
          </button>
          {notgroschenHomeMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                minWidth: 180,
                background: awBg.card,
                border: `1px solid ${awBg.cardBorder}`,
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                padding: 4,
                zIndex: 10,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setNotgroschenHomeDraft(String(notgroschenBalance));
                  setNotgroschenHomeEditing(true);
                  setNotgroschenHomeMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#e6edf3',
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Stand bearbeiten
              </button>
            </div>
          )}
        </div>
        <div style={S.label}>🛡️ Notgroschen</div>
        <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4, marginBottom: 10, paddingRight: 40 }}>
          Ziel (aus Onboarding): {fmt(notgroschenTarget)} · Fortschritt steuert u. a. die LevelUp-Freigabe.
        </div>
        {notgroschenHomeEditing ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>Neuer Stand (€)</div>
            <input
              style={{ ...S.input, width: '100%', maxWidth: 220, marginBottom: 8 }}
              inputMode="decimal"
              autoFocus
              value={notgroschenHomeDraft}
              onChange={(e) => setNotgroschenHomeDraft(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{ ...S.btn(), marginTop: 0 }}
                onClick={() => {
                  const n = Math.max(0, parseFloat(notgroschenHomeDraft.replace(',', '.')) || 0);
                  setNotgroschenBalance(Math.round(n * 100) / 100);
                  setNotgroschenHomeEditing(false);
                }}
              >
                Speichern
              </button>
              <button
                type="button"
                style={{ ...S.chip(false), marginTop: 0 }}
                onClick={() => setNotgroschenHomeEditing(false)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Aktueller Stand</div>
            <div style={{ ...S.bigNum, color: '#5b93ff' }}>{fmt(notgroschenBalance)}</div>
          </div>
        )}
        <Bar pct={notgroschenTarget > 0 ? Math.min(100, (notgroschenBalance / notgroschenTarget) * 100) : 0} color="#5b93ff" />
        <div style={{ fontSize: 11, color: '#7d8590', marginTop: 6 }}>
          {notgroschenTarget > 0 ? `${((notgroschenBalance / notgroschenTarget) * 100).toFixed(0)} % vom Ziel` : 'Nach dem Onboarding erscheint hier dein Ziel.'}
        </div>
      </div>

      {debts.some((d) => d.remaining > 0) && (
        <div style={S.card}>
          <div style={{ ...S.row, marginBottom: 10 }}>
            <div style={S.label}>💥 Schulden-Status</div>
            <div style={{ color: '#f0883e', fontWeight: 800 }}>{fmt(totalDebt)}</div>
          </div>
          {housePropertyValueTotal > 0 && (
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 10, lineHeight: 1.45 }}>
              🏠 Immobilien-Eigenkapital:{' '}
              <strong style={{ color: houseEquityTotal >= 0 ? '#2563eb' : '#ff7b7b' }}>{fmt(houseEquityTotal)}</strong>
              <span style={{ color: '#484f58' }}> (Marktwert {fmt(housePropertyValueTotal)} − Kredit)</span>
            </div>
          )}
          {debts
            .filter((d) => d.remaining > 0)
            .map((d) => (
              <div key={d.id} style={{ marginBottom: 8 }}>
                <div style={{ ...S.row, marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{d.name}</span>
                  <span style={{ fontSize: 11, color: '#7d8590' }}>
                    {fmt(d.remaining)} / {fmt(d.total)}
                  </span>
                </div>
                <Bar pct={(1 - d.remaining / d.total) * 100} color="#f0883e" />
              </div>
            ))}
        </div>
      )}

      {!levelUpLocked && (
        <div style={{ ...S.card, border: '1px solid #7c3aed44' }}>
          <div
            aria-hidden
            style={{
              padding: '18px 14px 20px',
              borderTop: `1px solid ${awBg.cardBorder}`,
              background: 'linear-gradient(180deg, rgba(5,5,6,0) 0%, rgba(124,58,237,0.07) 45%, rgba(5,5,6,0) 100%)',
            }}
          >
            <div
              style={{
                height: 2,
                borderRadius: 99,
                background: `repeating-linear-gradient(90deg, ${awBg.line} 0px, ${awBg.line} 5px, transparent 5px, transparent 11px)`,
                opacity: 0.85,
              }}
            />
            <div
              style={{
                fontSize: 10,
                color: '#6e7681',
                textAlign: 'center',
                marginTop: 14,
                letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                fontWeight: 700,
              }}
            >
              Jahresüberblick · Portfolio
            </div>
          </div>
          <div data-tour="home-portfolio" style={{ paddingTop: 4 }}>
            <div style={S.label}>💎 Portfolio Power</div>
            <div
              style={{ fontSize: 11, color: '#7d8590', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontWeight: 700 }}
            >
              Gesamt (Positionen + Cash Depot)
            </div>
            <div style={{ ...S.bigNum, color: '#a855f7' }}>{fmt(portfolioTotalPower)}</div>
            {(() => {
              const b = portfolioPowerBadgeFor(portfolioTotalPower);
              return b ? (
                <div style={{ fontSize: b.fontSize, fontWeight: b.fontWeight, color: b.color, marginTop: 4 }}>
                  {b.emoji ? `${b.emoji} ` : ''}
                  {b.text}
                </div>
              ) : null;
            })()}
            <div style={{ fontSize: 11, color: '#7d8590', marginTop: 8, lineHeight: 1.45 }}>
              Davon investiert: {fmt(portfolioValue)} · Cash Depot: {fmt(portfolioBrokerCash)}. Aufschlüsselung im Tab „LevelUp“.
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCharts = () => {
    const applyOverviewDemoSample = () => {
      if (!window.confirm(`Musterbeispiel Jan–Apr 2026 laden?\n\n${OVERVIEW_DEMO_HINT}`)) return;
      const snap = getOverviewDemoSnapshot();
      setDebts(snap.debts);
      setTx(snap.transactions);
      setNotgroschenBalance(snap.notgroschenBalance);
      setPortfolioBrokerCash(snap.portfolioBrokerCash);
      setPortfolioTrades(snap.portfolioTrades);
      setDailyVermogenSnapshots(snap.dailyVermogenSnapshots);
      showToast('Muster geladen — Tages-Verlauf, Money und Abbau‑Kurve (Schulden) zum Anschauen.', 'level');
    };

    return (
    <div data-tour="charts-main" style={S.section}>
      <div
        style={{
          ...S.card,
          marginBottom: 14,
          border: `1px solid ${awBg.line}`,
          background: '#121820',
        }}
      >
        <div style={S.label}>🧪 Musterbeispiel Übersicht</div>
        <div style={{ fontSize: 12, color: '#8b949e', marginTop: 6, lineHeight: 1.5 }}>
          Lädt Demo-Daten für <strong style={{ color: '#c9d1d9' }}>Jan–Apr 2026</strong>: Money-Buchungen (Kreditrate, Sparrate, Cash Depot …) plus{' '}
          <strong style={{ color: '#c9d1d9' }}>acht feste Tages-Snapshots</strong> für die Kurven „Komplette Vermögensübersicht“ und „Portfolio + Cash“ — so siehst du sofort den Tagesmodus.
          Abbau‑Kurve unter Schulden‑Entwicklung wie zuvor.
        </div>
        <div style={{ fontSize: 11, color: '#7d8590', marginTop: 10, lineHeight: 1.45 }}>{OVERVIEW_DEMO_HINT}</div>
        <button
          type="button"
          onClick={applyOverviewDemoSample}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #58a6ff66',
            background: '#1f3a5f',
            color: '#c9e4ff',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Muster Jan–Apr 2026 laden
        </button>
      </div>
      <HomeChartsSection
        standalonePage
        levelUpLocked={levelUpLocked}
        moneyYearOverview={{ reportYear, buckets: monthlyBuckets, levelUpLocked, formatMoney: fmt }}
        transactions={transactions}
        debts={debts.map((d) => ({
          id: d.id,
          remaining: d.remaining,
          total: d.total,
          kind: d.kind,
          propertyValue: d.propertyValue,
        }))}
        notgroschenBalance={notgroschenBalance}
        portfolioBrokerCash={portfolioBrokerCash}
        portfolioTrades={portfolioTrades}
        marketPrices={chartMarketPrices}
        fixedPie={chartFixedPie}
        varPie={chartVarPie}
        incomePie={chartIncomePie}
        dailyVermogenSnapshots={dailyVermogenSnapshots}
      />
    </div>
    );
  };

  const renderMoneyTxRow = (tx: Transaction) => (
    <div key={tx.id} style={{ ...S.txRow, alignItems: 'flex-start', gap: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{tx.category}</div>
        <div style={{ fontSize: 11, color: '#7d8590' }}>
          {(() => {
            const boost = tx.linkedDebtName ? `Boost: ${tx.linkedDebtName}` : '';
            const ng = tx.fillsNotgroschen ? 'Home: Notgroschen +' : tx.debitsNotgroschen ? 'Home: Notgroschen −' : '';
            const cd = tx.debitsCashDepot ? 'LevelUp: Cash −' : tx.creditsCashDepot ? 'LevelUp: Cash +' : '';
            const divFee =
              tx.type === 'einnahme' && tx.category === 'Dividende' && ((tx.feeEur ?? 0) > 0 || (tx.taxEur ?? 0) > 0)
                ? `netto Cash ${fmt(Math.round((txAmountNum(tx) - (tx.feeEur ?? 0) - (tx.taxEur ?? 0)) * 100) / 100)}`
                : '';
            const bits = [boost, ng, cd, divFee, tx.paymentMethod, tx.note].filter(Boolean);
            const sub = bits.join(' · ');
            return sub ? `${sub} · ${formatTxDateLabel(tx.date)}` : formatTxDateLabel(tx.date);
          })()}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, color: tx.type === 'einnahme' ? '#2563eb' : '#ff7b7b' }}>
          {tx.type === 'einnahme' ? '+' : '-'}
          {fmt(+tx.amount)}
        </div>
        {tx.foreignCurrency && tx.foreignAmount != null && tx.foreignCurrency !== baseCurrency && (
          <div style={{ fontSize: 10, color: '#7d8590', fontWeight: 500, lineHeight: 1.3, textAlign: 'right' }}>
            {formatForeignPaidLine(tx.foreignAmount, tx.foreignCurrency)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            aria-label="Buchung bearbeiten"
            onClick={() => startEditTx(tx)}
            style={{ ...S.chip(editingTxId === tx.id), marginTop: 0, padding: '5px 10px', fontSize: 11 }}
          >
            ✏️
          </button>
          <button
            type="button"
            aria-label="Buchung löschen"
            onClick={() => deleteTx(tx.id)}
            style={{ ...S.chip(false), marginTop: 0, padding: '5px 10px', fontSize: 11, color: '#ff7b7b' }}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );

  const renderMoneyRecentTxList = () =>
    transactions.length > 0 ? (
      <div style={S.card}>
        <button
          type="button"
          aria-expanded={moneyTxListExpanded}
          onClick={() => setMoneyTxListExpanded((e) => !e)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: moneyTxListExpanded ? 8 : 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={S.label}>📜 Letzte Buchungen</div>
          <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>
            {transactions.length} {moneyTxListExpanded ? '▼' : '▶'}
          </span>
        </button>
        {!moneyTxListExpanded && (
          <div style={{ fontSize: 11, color: '#7d8590', marginTop: 2 }}>
            Zugeklappt — antippen zum Anzeigen.
          </div>
        )}
        {moneyTxListExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {moneyTxMonthGroups.map((group) => {
              const key = moneyTxMonthKey(group.year, group.month0);
              const open = moneyTxOpenMonths[key] ?? false;
              return (
                <div
                  key={key}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${awBg.line}`,
                    background: awBg.hole,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setMoneyTxOpenMonths((prev) => ({ ...prev, [key]: !open }))}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#e6edf3', letterSpacing: '0.06em' }}>
                      {moneyTxMonthLabel(group.year, group.month0)}
                    </span>
                    <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 700 }}>
                      {group.txs.length} {open ? '▼' : '▶'}
                    </span>
                  </button>
                  {open ? (
                    <div style={{ padding: '0 10px 8px' }}>{group.txs.map((tx) => renderMoneyTxRow(tx))}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#7d8590', padding: '0 12px 10px' }}>Zugeklappt — antippen zum Anzeigen.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    ) : null;

  const renderTransactions = () => (
    <div style={{ ...S.section, scrollMarginBottom: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 10, minHeight: 36 }}>
        <div ref={moneyOverflowRef} style={{ position: 'relative', zIndex: 5 }}>
          <button
            type="button"
            aria-expanded={moneyOverflowOpen}
            aria-haspopup="menu"
            aria-label="Money-Optionen"
            onClick={() => setMoneyOverflowOpen((o) => !o)}
            style={{
              background: '#24242c',
              border: `1px solid ${awBg.line}`,
              borderRadius: 8,
              width: 40,
              height: 36,
              cursor: 'pointer',
              color: '#e6edf3',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⋮
          </button>
          {moneyOverflowOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                minWidth: 260,
                background: awBg.card,
                border: `1px solid ${awBg.cardBorder}`,
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                padding: 4,
                zIndex: 20,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoneyOverflowOpen(false);
                  setDebtAddOpen(true);
                  setTab('debts');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#e6edf3',
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  lineHeight: 1.35,
                }}
              >
                <span style={{ fontWeight: 700 }}>Neue Schuld / Kredit</span>
                <span style={{ display: 'block', fontSize: 11, color: '#7d8590', marginTop: 4, fontWeight: 400 }}>
                  Öffnet Boost mit Formular — z. B. nach neuem Kredit
                </span>
              </button>
              <div
                style={{
                  borderTop: `1px solid ${awBg.cardBorder}`,
                  marginTop: 4,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                <div style={{ fontSize: 11, color: '#7d8590', padding: '4px 12px 6px', fontWeight: 600 }}>
                  Grundwährung
                </div>
                <select
                  value={baseCurrency}
                  onChange={(e) => applyBaseCurrency(e.target.value)}
                  style={{
                    ...S.select,
                    margin: '0 8px 6px',
                    width: 'calc(100% - 16px)',
                    fontSize: 12,
                  }}
                  aria-label="Grundwährung"
                >
                  {MONEY_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {moneyCurrencyOptionLabel(c.code)}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: '#7d8590', padding: '0 12px 8px', lineHeight: 1.45 }}>
                  Standard in „Neue Buchung“ — Fremdwährungen werden hierhin umgerechnet.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {renderMoneyRecentTxList()}
      <input
        ref={receiptCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
        onChange={onReceiptFilePicked}
      />
      <input
        ref={receiptLibraryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
        onChange={onReceiptFilePicked}
      />
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={S.label}>🧾 Kassenzettel-Scan</div>
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4, marginBottom: 10, lineHeight: 1.45 }}>
          Kassenzettel, Quittung oder Rechnung — Betrag & Händler werden vorausgefüllt (du prüfst vor dem Speichern).
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <button
            type="button"
            disabled={receiptScanning}
            style={{
              ...S.btn('#00d4aa'),
              flex: '1 1 140px',
              minWidth: 0,
              opacity: receiptScanning ? 0.75 : 1,
            }}
            onClick={() => {
              if (!authToken) {
                showToast('Bitte anmelden für den Kassenzettel-Scan.', 'error');
                return;
              }
              receiptCameraInputRef.current?.click();
            }}
          >
            {receiptScanning ? '⏳ …' : '📷 Beleg fotografieren'}
          </button>
          <button
            type="button"
            disabled={receiptScanning}
            style={{
              ...S.chip(false),
              flex: '1 1 140px',
              minWidth: 0,
              padding: '12px 14px',
              fontWeight: 700,
              fontSize: 14,
              opacity: receiptScanning ? 0.75 : 1,
              border: '1px solid #30363d',
            }}
            onClick={() => {
              if (!authToken) {
                showToast('Bitte anmelden für den Kassenzettel-Scan.', 'error');
                return;
              }
              receiptLibraryInputRef.current?.click();
            }}
          >
            {receiptScanning ? '⏳ …' : '🖼 Beleg aus Mediathek'}
          </button>
        </div>
        {receiptScanning && (
          <div style={{ fontSize: 12, color: '#00d4aa', marginTop: 8, fontWeight: 600 }}>Beleg wird gelesen…</div>
        )}
        <div style={{ fontSize: 11, color: '#7d8590', marginTop: 8, lineHeight: 1.45 }}>
          Das Foto wird nicht in der App gespeichert — nur die Buchung nach deiner Bestätigung.
        </div>
      </div>
      <div data-tour="money-form" style={S.card}>
        <button
          type="button"
          aria-expanded={moneyFormOpen}
          onClick={() => setMoneyFormOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: moneyFormOpen ? 10 : 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={S.label}>{editingTxId != null ? '✏️ Buchung bearbeiten' : '✨ Neue Buchung'}</div>
          <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>{moneyFormOpen ? '▼' : '▶'}</span>
        </button>
        {!moneyFormOpen && (
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
            {editingTxId != null ? 'Formular ist geöffnet — unten speichern oder abbrechen.' : 'Antippen, um eine Buchung einzutragen.'}
          </div>
        )}
        {moneyFormOpen && (
        <>
        <div style={{ fontSize: 11, color: '#7d8590', marginTop: 4, marginBottom: 10 }}>
          Zählt für Home und Jahresübersicht (Kalendermonat). Einnahmen (Gehalt, Trinkgeld, …): Summe aller Buchungen in der Liste „Einnahmen“ + Kreisdiagramm unter Übersicht. „Kreditrate“ + Schuld: Tilgung in Boost. Kategorie „Notgroschen“: Polster aufstocken. Zahlungsart „Notgroschen“: aus dem Polster zahlen. Zahlungsart „Cash Depot“: Broker-Cash abbuchen; „Einzahlung Cash Depot“: Broker-Cash aufstocken (Haushalt zählt weiter als Ausgabe). Abos/Miete/Kreditrate: „Laufende Fixkosten“; Essen, Fahrt, Kleidung u. a.: „Variable Kosten“ (jeweils letzter Betrag je Position).
          {!debts.some((d) => d.remaining > 0) && (
            <span> Keine offene Schuld? Neuen Kredit oben rechts über ⋮ in Boost anlegen.</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['einnahme', 'ausgabe'].map((t) => (
            <button
              key={t}
              style={{ ...S.chip(form.type === t), flex: 1 }}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  type: t as 'einnahme' | 'ausgabe',
                  category: CATS[t === 'einnahme' ? 'einnahmen' : 'ausgaben'][0],
                  linkedDebtId: '',
                  feeStr: '',
                  taxStr: '',
                  paymentMethod:
                    t === 'einnahme' && (f.paymentMethod === 'Notgroschen' || f.paymentMethod === 'Cash Depot' || f.paymentMethod === 'Einzahlung Cash Depot')
                      ? ''
                      : f.paymentMethod,
                }))
              }
            >
              {t === 'einnahme' ? '💰 Einnahme' : '💸 Ausgabe'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              style={{ ...S.input, flex: 1, marginBottom: 0 }}
              inputMode="decimal"
              placeholder={
                form.currency === baseCurrency
                  ? `Betrag in ${moneyCurrencySymbol(baseCurrency)} (z. B. 3200,50)`
                  : `Betrag in ${form.currency} (Bar vor Ort)`
              }
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: normalizeMoneyDecimalInput(e.target.value) }))}
            />
            <select
              style={{
                ...S.select,
                width: 'auto',
                minWidth: 118,
                maxWidth: 148,
                flexShrink: 0,
                marginBottom: 0,
                padding: '10px 8px',
                fontSize: 12,
              }}
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              aria-label="Währung"
            >
              {MONEY_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {moneyCurrencyOptionLabel(c.code)}
                </option>
              ))}
            </select>
          </div>
          {form.currency !== baseCurrency && (
            <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.45 }}>
              {fxLoading && 'Wechselkurs wird geladen…'}
              {!fxLoading && fxError && fxError}
              {!fxLoading && !fxError && convertedBasePreview != null && (
                <>
                  ≈{' '}
                  <strong style={{ color: '#c9d1d9' }}>{formatMoneyAmount(convertedBasePreview, baseCurrency)}</strong>{' '}
                  in {moneyCurrencyLabel(baseCurrency)}
                  {fxRateDate ? ` · EZB-Kurs vom ${fxRateDate}` : ''}
                </>
              )}
              {!fxLoading && !fxError && convertedBasePreview == null && String(form.amount).trim() && (
                <>Betrag eingeben — wird automatisch in {moneyCurrencyLabel(baseCurrency)} umgerechnet.</>
              )}
            </div>
          )}
          {form.type === 'einnahme' && form.category === 'Dividende' && (
            <>
              <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.45 }}>
                💸 Bruttobetrag oben — optional Gebühr/Steuer abziehen; netto landet im Cash Depot (LevelUp).
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...S.input, flex: 1, marginTop: 0, marginBottom: 0 }}
                  inputMode="decimal"
                  placeholder="Gebühr € (optional)"
                  value={form.feeStr}
                  onChange={(e) => setForm((f) => ({ ...f, feeStr: normalizeMoneyDecimalInput(e.target.value) }))}
                />
                <input
                  style={{ ...S.input, flex: 1, marginTop: 0, marginBottom: 0 }}
                  inputMode="decimal"
                  placeholder="Steuer € (optional)"
                  value={form.taxStr}
                  onChange={(e) => setForm((f) => ({ ...f, taxStr: normalizeMoneyDecimalInput(e.target.value) }))}
                />
              </div>
            </>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              background: awBg.field,
              border: `1px solid ${awBg.line}`,
              borderRadius: 10,
              padding: '6px 14px',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: 13, color: '#8b949e', flexShrink: 0 }}>📅 Datum</span>
            <input
              type="date"
              aria-label="Datum"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                color: '#e6edf3',
                fontSize: 14,
                outline: 'none',
                colorScheme: 'dark',
                textAlign: 'right',
              }}
            />
          </div>
          <select
            style={S.select}
            value={form.category}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({
                ...f,
                category: v,
                linkedDebtId: v === 'Kreditrate' ? f.linkedDebtId : '',
                feeStr: v === 'Dividende' ? f.feeStr : '',
                taxStr: v === 'Dividende' ? f.taxStr : '',
              }));
            }}
          >
            {(form.type === 'einnahme' ? CATS.einnahmen : CATS.ausgaben).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {form.type === 'ausgabe' && form.category === 'Abos' && (
            <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.45 }}>
              📺 Im Notizfeld den Namen eintragen (z. B. „Netflix“) — erscheint unter „Laufende Fixkosten“ mit dem zuletzt gebuchten Betrag.
            </div>
          )}
          {form.type === 'ausgabe' && form.category === 'Miete' && (
            <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.45 }}>
              🏠 Optional Bezeichnung in der Notiz (z. B. „Warmmiete“) — bei mehreren Miet-Positionen unterscheidet die Notiz die Einträge in „Laufende Fixkosten“.
            </div>
          )}
          {form.type === 'ausgabe' && form.category === 'Notgroschen' && (
            <div style={{ fontSize: 11, color: '#5b93ff', lineHeight: 1.45 }}>
              🛡️ Der Betrag wird deinem Notgroschen auf Home gutgeschrieben (zusätzlich als Ausgabe im Monat erfasst).
            </div>
          )}
          {form.type === 'ausgabe' && form.category === 'Kreditrate' && (
            <>
              <div style={{ fontSize: 11, color: '#f0883e', fontWeight: 600 }}>⚡ Welche Schuld tilgst du? (Boost)</div>
              <select
                style={S.select}
                value={form.linkedDebtId}
                onChange={(e) => setForm((f) => ({ ...f, linkedDebtId: e.target.value }))}
              >
                <option value="">
                  {debts.filter((d) => d.remaining > 0).length === 0 ? '— Zuerst unter Boost eine Schuld anlegen' : '— Schuld wählen (Pflicht)'}
                </option>
                {debts
                  .filter((d) => d.remaining > 0)
                  .map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} (Rest {fmt(d.remaining)})
                    </option>
                  ))}
              </select>
              <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.45, marginTop: 6 }}>
                Jede Tilgung erscheint unter „Laufende Fixkosten“ je Schuld (letzter Betrag).
              </div>
            </>
          )}
          <select style={S.select} value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
            {(form.type === 'einnahme'
              ? PAYMENT_METHOD_OPTIONS.filter((pm) => pm !== 'Notgroschen' && pm !== 'Cash Depot' && pm !== 'Einzahlung Cash Depot')
              : PAYMENT_METHOD_OPTIONS
            ).map((pm) => (
              <option key={pm || 'none'} value={pm}>
                {pm ? pm : '— Zahlungsart (optional)'}
              </option>
            ))}
          </select>
          {form.type === 'ausgabe' && form.paymentMethod === 'Cash Depot' && (
            <div style={{ fontSize: 11, color: '#a855f7', lineHeight: 1.45 }}>
              💎 Zahlung aus dem <strong style={{ color: '#e6edf3' }}>Cash Depot</strong> (LevelUp) — jetzt verfügbar: {fmt(portfolioBrokerCash)}
            </div>
          )}
          {form.type === 'ausgabe' && form.paymentMethod === 'Einzahlung Cash Depot' && (
            <div style={{ fontSize: 11, color: '#a855f7', lineHeight: 1.45 }}>
              💎 <strong style={{ color: '#e6edf3' }}>Einzahlung ins Cash Depot</strong> (LevelUp / Broker-Cash). Die Ausgabe erscheint trotzdem in deinem Money-Monat; Stand jetzt vor Buchung:{' '}
              {fmt(portfolioBrokerCash)}.
            </div>
          )}
          {form.type === 'ausgabe' && form.paymentMethod === 'Notgroschen' && (
            <div style={{ fontSize: 11, color: '#5b93ff', lineHeight: 1.45 }}>
              🛡️ Zahlung aus dem Notgroschen — der Stand auf Home wird um den Betrag verringert (Ausgabe bleibt im Monat erfasst).
            </div>
          )}
          <div style={{ position: 'relative' }} data-note-field>
            <input
              style={S.input}
              placeholder={
                form.type === 'ausgabe' && form.category === 'Abos'
                  ? 'Notiz z. B. Netflix, Spotify, Handyvertrag…'
                  : form.type === 'ausgabe' && form.category === 'Miete'
                    ? 'z. B. Warmmiete, Garage, Nebenkosten…'
                    : 'Notiz (optional)'
              }
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              aria-autocomplete="list"
              aria-expanded={noteSuggestions.length > 0}
              aria-controls={noteSuggestions.length > 0 ? 'money-note-suggestions' : undefined}
            />
            {noteSuggestions.length > 0 && (
              <div
                id="money-note-suggestions"
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  zIndex: 20,
                  borderRadius: 8,
                  border: `1px solid ${awBg.line}`,
                  background: awBg.card,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                }}
              >
                {noteSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    role="option"
                    aria-selected={form.note.trim() === suggestion}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      setForm((f) => ({ ...f, note: suggestion }));
                      (e.currentTarget.closest('[data-note-field]')?.querySelector('input') as HTMLInputElement | null)?.blur();
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: `1px solid ${awBg.line}`,
                      background: 'transparent',
                      color: '#e6edf3',
                      fontSize: 13,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <button style={{ ...S.btn(), flex: 1, minWidth: 120 }} onClick={addTx}>
              {editingTxId != null ? '✅ Aktualisieren' : '✅ Speichern'}
            </button>
            {editingTxId != null && (
              <button type="button" style={{ ...S.chip(false), marginTop: 8, flex: 1, minWidth: 100 }} onClick={resetMoneyForm}>
                Abbrechen
              </button>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      <div style={{ ...S.card, border: `1px solid ${awBg.line}`, background: awBg.hole }}>
        <button
          type="button"
          aria-expanded={moneyIncomeOpen}
          onClick={() => setMoneyIncomeOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: moneyIncomeOpen ? 6 : 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={S.label}>💰 Einnahmen</div>
            {!moneyIncomeOpen && (
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6 }}>
                {incomeOverviewRows.length} Pos. · Summe {fmt(incomeOverviewSum)}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>{moneyIncomeOpen ? '▼' : '▶'}</span>
        </button>
        {moneyIncomeOpen && (
          <>
            <div style={{ fontSize: 11, color: '#7d8590', marginTop: 2, marginBottom: 12, lineHeight: 1.45 }}>
              Aus Einnahmen in <strong style={{ color: '#e6edf3' }}>Gehalt</strong>, <strong style={{ color: '#e6edf3' }}>Trinkgeld</strong>, <strong style={{ color: '#e6edf3' }}>Gutschrift</strong>, <strong style={{ color: '#e6edf3' }}>Geschenk</strong>, Dividende, Zinsen, Freelance, Nebenjob, Sonstiges. Je{' '}
              <strong style={{ color: '#e6edf3' }}>Kategorie + Notizzeile</strong> die <strong style={{ color: '#e6edf3' }}>Summe aller Buchungen</strong> — Kreisdiagramm nach Kategorie unter Tab{' '}
              <strong style={{ color: '#e6edf3' }}>Übersicht</strong>.
            </div>
            {incomeOverviewRows.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Noch keine Einnahmen gebucht.</div>
            ) : (
              incomeOverviewRows.map((row) => (
                <div key={`inc-${row.key}`} style={{ ...S.txRow, marginBottom: 2 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 2 }}>{row.category}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{row.title}</div>
                    <div style={{ fontSize: 11, color: '#7d8590' }}>
                      {row.count > 1 ? `${row.count} Buchungen · ` : ''}
                      Zuletzt {formatTxDateLabel(row.latest.date)}
                      {row.latest.paymentMethod ? ` · ${row.latest.paymentMethod}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#2563eb', flexShrink: 0 }}>{fmt(row.sum)}</div>
                </div>
              ))
            )}
            {incomeOverviewRows.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px solid ${awBg.cardBorder}`,
                  fontSize: 12,
                  color: '#8b949e',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap' as const,
                }}
              >
                <span>Summe (alle Einnahmen)</span>
                <span style={{ fontWeight: 800, color: '#2563eb' }}>{fmt(incomeOverviewSum)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ ...S.card, border: `1px solid ${awBg.line}`, background: awBg.hole }}>
        <button
          type="button"
          aria-expanded={moneyFixedCostsOpen}
          onClick={() => setMoneyFixedCostsOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: moneyFixedCostsOpen ? 6 : 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={S.label}>📌 Laufende Fixkosten</div>
            {!moneyFixedCostsOpen && (
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6 }}>
                {fixedCostOverviewRows.length} Pos. · Summe {fmt(fixedCostOverviewSum)}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>{moneyFixedCostsOpen ? '▼' : '▶'}</span>
        </button>
        {moneyFixedCostsOpen && (
          <>
            <div style={{ fontSize: 11, color: '#7d8590', marginTop: 2, marginBottom: 12, lineHeight: 1.45 }}>
              Aus Ausgaben der Kategorien <strong style={{ color: '#e6edf3' }}>Abos</strong>, <strong style={{ color: '#e6edf3' }}>Miete</strong> und{' '}
              <strong style={{ color: '#e6edf3' }}>Kreditrate</strong>. Je Position gilt die{' '}
              <strong style={{ color: '#e6edf3' }}>letzte Buchung</strong> (Abos/Miete: Name in der Notiz; Kreditraten: Schuld aus Boost).
            </div>
            {fixedCostOverviewRows.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Noch keine Fixkosten gebucht.</div>
            ) : (
              fixedCostOverviewRows.map((tx) => (
                <div key={`fix-${fixedCostDedupeKey(tx)}`} style={{ ...S.txRow, marginBottom: 2 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 2 }}>
                      {fixedCostKindShort(tx.category)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{formatFixedCostTitle(tx)}</div>
                    <div style={{ fontSize: 11, color: '#7d8590' }}>
                      Zuletzt {formatTxDateLabel(tx.date)}
                      {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#ff7b7b', flexShrink: 0 }}>{fmt(+tx.amount)}</div>
                </div>
              ))
            )}
            {fixedCostOverviewRows.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px solid ${awBg.cardBorder}`,
                  fontSize: 12,
                  color: '#8b949e',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap' as const,
                }}
              >
                <span>Summe (letzte Beträge je Position)</span>
                <span style={{ fontWeight: 800, color: '#e6edf3' }}>{fmt(fixedCostOverviewSum)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ ...S.card, border: `1px solid ${awBg.line}`, background: awBg.hole }}>
        <button
          type="button"
          aria-expanded={moneyVarCostsOpen}
          onClick={() => setMoneyVarCostsOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: moneyVarCostsOpen ? 6 : 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={S.label}>📎 Variable Kosten</div>
            {!moneyVarCostsOpen && (
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6 }}>
                {variableCostOverviewRows.length} Pos. · Summe {fmt(variableCostOverviewSum)}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>{moneyVarCostsOpen ? '▼' : '▶'}</span>
        </button>
        {moneyVarCostsOpen && (
          <>
            <div style={{ fontSize: 11, color: '#7d8590', marginTop: 2, marginBottom: 12, lineHeight: 1.45 }}>
              Aus Ausgaben in <strong style={{ color: '#e6edf3' }}>{'Essen & Trinken'}</strong>,{' '}
              <strong style={{ color: '#e6edf3' }}>Fahrtkosten</strong>, Kleidung, Gesundheit, Freizeit, Sonstiges. Je{' '}
              <strong style={{ color: '#e6edf3' }}>Kategorie + Notizzeile</strong> die letzte Buchung — damit mehrere Märkte/Projekte nebeneinander getrennt sind.
            </div>
            {variableCostOverviewRows.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>Noch keine variablen Kosten gebucht.</div>
            ) : (
              variableCostOverviewRows.map((tx) => (
                <div key={`var-${varCostDedupeKey(tx)}`} style={{ ...S.txRow, marginBottom: 2 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 2 }}>{tx.category}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{formatVarCostTitle(tx)}</div>
                    <div style={{ fontSize: 11, color: '#7d8590' }}>
                      Zuletzt {formatTxDateLabel(tx.date)}
                      {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#ff7b7b', flexShrink: 0 }}>{fmt(+tx.amount)}</div>
                </div>
              ))
            )}
            {variableCostOverviewRows.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px solid ${awBg.cardBorder}`,
                  fontSize: 12,
                  color: '#8b949e',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap' as const,
                }}
              >
                <span>Summe (letzte Beträge je Position)</span>
                <span style={{ fontWeight: 800, color: '#e6edf3' }}>{fmt(variableCostOverviewSum)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderDebts = () => {
    const activeDebts = debts.filter((d) => d.remaining > 0);
    const sortDebtsByRemaining = (a: Debt, b: Debt) => b.remaining - a.remaining || b.id - a.id;
    const houseDebts = activeDebts.filter((d) => d.kind === 'house').sort(sortDebtsByRemaining);
    const consumerDebts = activeDebts.filter((d) => d.kind !== 'house').sort(sortDebtsByRemaining);
    const houseDebtSum = houseDebts.reduce((s, d) => s + d.remaining, 0);
    const consumerDebtSum = consumerDebts.reduce((s, d) => s + d.remaining, 0);
    const houseMonthlySum = houseDebts.reduce((s, d) => s + d.monthly, 0);
    const consumerMonthlySum = consumerDebts.reduce((s, d) => s + d.monthly, 0);
    const archivedDebts = debts
      .filter((d) => d.remaining <= 0)
      .sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || '') || b.id - a.id);

    const renderActiveDebtCard = (d: Debt, groupPeers: Debt[]) => {
      const pct = d.total > 0 ? ((d.total - d.remaining) / d.total) * 100 : 0;
      const otherOpenInGroup = groupPeers.filter((x) => x.id !== d.id).length;
      const pv = debtPropertyValue(d);
      const equity = debtEquity(d);
      return (
        <div key={d.id} style={{ ...S.debtCard, border: `1px solid ${awBg.cardBorder}`, marginBottom: 10 }}>
          <div style={S.row}>
            <div style={{ fontWeight: 700 }}>{d.name}</div>
            {d.interest > 0 && (
              <div style={{ fontSize: 11, color: '#ff7b7b', background: '#ff7b7b22', padding: '2px 8px', borderRadius: 99 }}>
                {d.interest}% Zinsen
              </div>
            )}
          </div>
          <div style={{ ...S.row, margin: '10px 0 6px' }}>
            <span style={{ fontSize: 12, color: '#7d8590' }}>Noch offen 🎯</span>
            <span style={{ fontWeight: 700, color: '#f0883e' }}>{fmt(d.remaining)}</span>
          </div>
          {pv > 0 && equity != null && (
            <div
              style={{
                marginBottom: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: '#0f141b',
                border: '1px solid #2563eb44',
              }}
            >
              <div style={{ ...S.row, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#8b949e' }}>🏠 Marktwert Immobilie</span>
                <span style={{ fontWeight: 700, color: '#93c5fd' }}>{fmt(pv)}</span>
              </div>
              <div style={S.row}>
                <span style={{ fontSize: 11, color: '#8b949e' }}>Eigenkapital (netto)</span>
                <span style={{ fontWeight: 800, color: equity >= 0 ? '#2563eb' : '#ff7b7b' }}>{fmt(equity)}</span>
              </div>
              {equity < 0 && (
                <div style={{ fontSize: 10, color: '#ff7b7b', marginTop: 6, lineHeight: 1.4 }}>
                  Restschuld liegt über dem Marktwert — Wert in „Bearbeiten“ anpassen.
                </div>
              )}
            </div>
          )}
          <Bar pct={pct} color="#f0883e" />
          <div style={{ fontSize: 11, color: '#7d8590', textAlign: 'right', marginTop: 4 }}>{Math.round(pct)}% getilgt</div>
          {otherOpenInGroup > 0 && (
            <div style={{ fontSize: 10, color: '#5b93ff', marginTop: 8, lineHeight: 1.4 }}>
              Tipp: Wenn diese Schuld weg ist, kannst du die frei werdende Rate bei {otherOpenInGroup} weiteren Posten in dieser Gruppe anheben. ⚡
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#7d8590', marginBottom: 6 }}>Monatliche Rate (€)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <input
                type="number"
                min={0}
                step={1}
                value={d.monthly}
                onChange={(e) => updateDebtMonthly(d.id, e.target.value)}
                style={{
                  width: 100,
                  background: awBg.hole,
                  border: `1px solid ${awBg.line}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#e6edf3',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              />
              <span style={{ fontSize: 11, color: '#7d8590' }}>pro Rate-Zahlung abgezogen</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' as const }}>
            <button
              type="button"
              style={{
                flex: 1,
                minWidth: 120,
                background: '#f0883e',
                color: '#fff',
                border: '1px solid #ffb47a66',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 12px rgba(240, 136, 62, 0.28)',
              }}
              onClick={() => payDebt(d.id)}
            >
              ⚡ Rate zahlen
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                minWidth: 120,
                background: '#24242c',
                color: '#93c5fd',
                border: '1px solid #2563eb66',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
              onClick={() => settleDebtFull(d.id)}
            >
              ✅ Komplett bezahlt
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                minWidth: 120,
                background: '#1f2a3a',
                color: '#93c5fd',
                border: '1px solid #5b93ff66',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
              onClick={() => startEditDebt(d.id)}
            >
              ✏️ Bearbeiten
            </button>
          </div>
        </div>
      );
    };

    const housePropertySum = houseDebts.reduce((s, d) => s + debtPropertyValue(d), 0);
    const houseEquitySum = houseDebts.reduce((s, d) => {
      const eq = debtEquity(d);
      return eq != null ? s + eq : s;
    }, 0);

    const renderDebtGroup = (
      title: string,
      groupDebts: Debt[],
      groupSum: number,
      monthlySum: number,
      open: boolean,
      onToggle: () => void,
      showPropertyMetrics = false,
    ) => {
      if (groupDebts.length === 0) return null;
      return (
        <div style={{ ...S.card, border: `1px solid ${awBg.line}`, background: awBg.hole }}>
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              background: 'none',
              border: 'none',
              padding: 0,
              marginBottom: open ? 10 : 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={S.label}>{title}</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6 }}>
                {groupDebts.length} {groupDebts.length === 1 ? 'Schuld' : 'Schulden'} · Restsumme{' '}
                <strong style={{ color: '#f0883e' }}>{fmt(groupSum)}</strong>
                {monthlySum > 0 ? (
                  <>
                    {' '}
                    · Raten gesamt <strong style={{ color: '#e6edf3' }}>{fmt(monthlySum)}</strong>/Monat
                  </>
                ) : null}
                {showPropertyMetrics && housePropertySum > 0 ? (
                  <>
                    <div style={{ marginTop: 6 }}>
                      Marktwert gesamt <strong style={{ color: '#93c5fd' }}>{fmt(housePropertySum)}</strong>
                      {' · '}
                      Eigenkapital gesamt <strong style={{ color: houseEquitySum >= 0 ? '#2563eb' : '#ff7b7b' }}>{fmt(houseEquitySum)}</strong>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
          </button>
          {open ? (
            <>
              {groupDebts.map((d) => renderActiveDebtCard(d, groupDebts))}
              {showPropertyMetrics && housePropertySum > 0 && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #2563eb44',
                    background: '#121820',
                    fontSize: 12,
                    color: '#8b949e',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap' as const,
                  }}
                >
                  <span>Immobilie netto (Marktwert − Kredite)</span>
                  <span style={{ fontWeight: 800, color: houseEquitySum >= 0 ? '#2563eb' : '#ff7b7b' }}>{fmt(houseEquitySum)}</span>
                </div>
              )}
              {groupDebts.length > 1 && (
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 10,
                    borderTop: `1px solid ${awBg.cardBorder}`,
                    fontSize: 12,
                    color: '#8b949e',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap' as const,
                  }}
                >
                  <span>Gruppensumme (noch offen)</span>
                  <span style={{ fontWeight: 800, color: '#f0883e' }}>{fmt(groupSum)}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#7d8590' }}>Zugeklappt — antippen zum Anzeigen.</div>
          )}
        </div>
      );
    };

    return (
    <div style={S.section}>
      <div data-tour="boost-debts" style={{ ...S.card, background: '#1a1208', border: '1px solid #f0883e33' }}>
        <div style={S.label}>⚡ Gesamtschulden</div>
        <div style={{ ...S.bigNum, color: '#f0883e' }}>{fmt(totalDebt)}</div>
        <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4 }}>Du schaffst das! Jede Tilgung bringt dich näher zur Freiheit. 💪</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 150, border: '1px solid #f0883e44', borderRadius: 10, padding: '8px 10px', background: '#0f141b' }}>
            <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700 }}>🏠 Hauskredit (gesamt)</div>
            <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: '#f0883e' }}>{fmt(houseDebtSum)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 150, border: '1px solid #f0883e44', borderRadius: 10, padding: '8px 10px', background: '#0f141b' }}>
            <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700 }}>💳 Kreditschulden (gesamt)</div>
            <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: '#f0883e' }}>{fmt(consumerDebtSum)}</div>
          </div>
          {housePropertySum > 0 && (
            <div style={{ flex: 1, minWidth: 150, border: '1px solid #2563eb44', borderRadius: 10, padding: '8px 10px', background: '#0f141b' }}>
              <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 700 }}>🏠 Immobilien-Eigenkapital</div>
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: houseEquitySum >= 0 ? '#2563eb' : '#ff7b7b' }}>{fmt(houseEquitySum)}</div>
              <div style={{ fontSize: 10, color: '#7d8590', marginTop: 4 }}>Marktwert {fmt(housePropertySum)} − Kredit {fmt(houseDebtSum)}</div>
            </div>
          )}
        </div>
        {levelUpLocked && housePropertySum === 0 && houseDebts.length > 0 && (
          <div style={{ fontSize: 11, color: '#7d8590', marginTop: 10, lineHeight: 1.45 }}>
            Tipp: Unter „Hauskredit“ bei jeder Immobilie den <strong style={{ color: '#c9d1d9' }}>Marktwert</strong> eintragen (Bearbeiten) — dann siehst du dein Eigenkapital auch ohne LevelUp.
          </div>
        )}
      </div>

      <div style={{ ...S.card, border: '1px solid #2563eb33' }}>
        <div style={{ ...S.row, alignItems: 'center' }}>
          <div>
            <div style={S.label}>➕ Neue Schuld</div>
            <div style={{ fontSize: 11, color: '#7d8590', marginTop: 2 }}>
              {editingDebtId != null ? 'Schuld bearbeiten (Name, Betrag, Zinsen, Rate, Typ)' : 'Name, Betrag, Zinsen & Rate erfassen'}
            </div>
          </div>
          <button
            type="button"
            aria-expanded={debtAddOpen}
            aria-label={debtAddOpen ? 'Formular schließen' : 'Neue Schuld hinzufügen'}
            onClick={() => setDebtAddOpen((o) => !o)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              border: debtAddOpen ? '2px solid #2563eb' : `2px solid ${awBg.line}`,
              background: debtAddOpen ? '#2563eb22' : awBg.card,
              color: '#93c5fd',
              fontSize: 28,
              fontWeight: 300,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: debtAddOpen ? '0 0 20px rgba(37, 99, 235,0.2)' : 'none',
            }}
          >
            +
          </button>
        </div>
        {debtAddOpen && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              style={S.input}
              placeholder="Name (z. B. Kreditkarte)"
              value={newDebtName}
              onChange={(e) => setNewDebtName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...S.chip(newDebtKind === 'consumer'), flex: 1, marginTop: 0 }} onClick={() => setNewDebtKind('consumer')}>
                Dispo / Konsum
              </button>
              <button type="button" style={{ ...S.chip(newDebtKind === 'house'), flex: 1, marginTop: 0 }} onClick={() => setNewDebtKind('house')}>
                Hauskredit
              </button>
            </div>
            <input
              style={S.input}
              inputMode="decimal"
              placeholder={`Gesamtbetrag / Schuldenhöhe (${moneyCurrencySymbol(baseCurrency)})`}
              value={newDebtTotal}
              onChange={(e) => setNewDebtTotal(e.target.value)}
            />
            <input
              style={S.input}
              inputMode="decimal"
              placeholder="Zinsen p.a. in % (0 wenn zinsfrei)"
              value={newDebtInterest}
              onChange={(e) => setNewDebtInterest(e.target.value)}
            />
            <input
              style={S.input}
              inputMode="decimal"
              placeholder={`Monatliche Rate (${moneyCurrencySymbol(baseCurrency)})`}
              value={newDebtMonthly}
              onChange={(e) => setNewDebtMonthly(e.target.value)}
            />
            {newDebtKind === 'house' && (
              <>
                <input
                  style={S.input}
                  inputMode="decimal"
                  placeholder={`Marktwert der Immobilie (${moneyCurrencySymbol(baseCurrency)}, optional)`}
                  value={newDebtPropertyValue}
                  onChange={(e) => setNewDebtPropertyValue(e.target.value)}
                />
                <div style={{ fontSize: 11, color: '#7d8590', lineHeight: 1.45, marginTop: -4 }}>
                  Gegenwert der Immobilie — auch ohne LevelUp. Eigenkapital = Marktwert minus noch offene Restschuld.
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" style={{ ...S.btn(), flex: 1, marginTop: 0 }} onClick={addDebtEntry}>
                {editingDebtId != null ? '✅ Änderungen speichern' : '✅ Schuld speichern'}
              </button>
              <button
                type="button"
                style={{
                  ...S.chip(false),
                  marginTop: 0,
                  padding: '12px 16px',
                  fontWeight: 700,
                }}
                onClick={() => {
                  resetDebtForm();
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {activeDebts.length === 0 && (
        <div style={{ ...S.card, border: `1px dashed ${awBg.line}`, background: awBg.hole }}>
          <div style={{ fontSize: 13, color: '#7d8590', textAlign: 'center' }}>
            Aktuell keine offene Schuld. Erfasse oben eine neue oder schau ins Archiv. ✨
          </div>
        </div>
      )}

      {renderDebtGroup(
        '🏠 Hauskredit',
        houseDebts,
        houseDebtSum,
        houseMonthlySum,
        boostHouseDebtsOpen,
        () => setBoostHouseDebtsOpen((o) => !o),
        true,
      )}
      {renderDebtGroup(
        '💳 Kreditschulden',
        consumerDebts,
        consumerDebtSum,
        consumerMonthlySum,
        boostConsumerDebtsOpen,
        () => setBoostConsumerDebtsOpen((o) => !o),
      )}

      {archivedDebts.length > 0 && (
        <div style={{ ...S.card, border: `1px solid ${awBg.line}`, background: awBg.hole }}>
          <button
            type="button"
            onClick={() => setDebtArchiveOpen((o) => !o)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              color: '#e6edf3',
              cursor: 'pointer',
              padding: '4px 0 8px',
            }}
          >
            <span style={{ ...S.label, margin: 0 }}>📂 Archiv ({archivedDebts.length})</span>
            <span style={{ fontSize: 14, color: '#7d8590' }}>{debtArchiveOpen ? '▾' : '▸'}</span>
          </button>
          {debtArchiveOpen && (
            <div style={{ marginTop: 4 }}>
              {archivedDebts.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '12px 0',
                    borderTop: `1px solid ${awBg.cardBorder}`,
                    opacity: 0.92,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#7d8590' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#484f58', marginTop: 2 }}>
                      Ursprung {fmt(d.total)}
                      {d.interest > 0 ? ` · ${d.interest}% p.a.` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb' }}>✅ Abbezahlt</div>
                    <div style={{ fontSize: 10, color: '#484f58', marginTop: 2 }}>{d.archivedAt || 'Archiv'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  const renderInvest = () => (
    <div style={S.section}>
      {onboardingV2?.invest && !levelUpLocked && (
        <div style={{ ...S.card, border: `1px solid ${awBg.line}`, marginBottom: 12 }}>
          <div style={S.label}>📋 Aus deinem Onboarding</div>
          <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.5, marginTop: 6 }}>
            Risiko: {onboardingV2.invest.risk === 'low' ? 'konservativ' : onboardingV2.invest.risk === 'high' ? 'aggressiv' : 'ausgewogen'} · ca. investiert:{' '}
            {fmt(onboardingV2.invest.approxInvested)} · monatlich geplant: {fmt(onboardingV2.invest.monthlyWant)}
          </div>
          {onboardingV2.whyHere?.length > 0 && (
            <div style={{ fontSize: 11, color: '#7d8590', marginTop: 8 }}>Warum hier: {onboardingV2.whyHere.join(', ')}</div>
          )}
          <div style={{ fontSize: 11, color: '#5b93ff', marginTop: 10, lineHeight: 1.45 }}>
            Watchlist-Stückzahlen: automatische Verteilung oder die Zuordnung pro Zeile aus dem Onboarding (Kaufpreis × Menge → EUR auf gewähltes Symbol). Anpassen jederzeit unter „Order in Stückzahl“.
          </div>
        </div>
      )}
      {levelUpLocked && (
        <div style={{ ...S.card, border: '1px solid #f0883e55', background: '#1a1208', marginBottom: 12 }}>
          <div style={S.label}>LevelUp gesperrt</div>
          <div style={{ fontSize: 14, color: '#c9d1d9', lineHeight: 1.55, marginTop: 8 }}>
            {levelUpMode === 'until_all_debts' && (
              <>Zuerst alle Schulden tilgen — danach schalten wir LevelUp automatisch frei.</>
            )}
            {levelUpMode === 'until_emergency_half' && (
              <>
                Bitte baut euer Notgroschen auf mindestens die Hälfte des Ziels ({fmt(notgroschenTarget * 0.5)} von {fmt(notgroschenTarget)}) — Stand unter Home über ⋮ → „Stand bearbeiten“.
              </>
            )}
          </div>
        </div>
      )}
      <div data-tour="portfolio-power" style={{ ...S.card, border: '1px solid #7c3aed44', position: 'relative' }}>
        <div ref={portfolioCashMenuRef} style={{ position: 'absolute', top: 10, right: 8, zIndex: 2 }}>
          <button
            type="button"
            aria-expanded={portfolioCashMenuOpen}
            aria-haspopup="menu"
            aria-label="Portfolio-Cash-Optionen"
            onClick={() => setPortfolioCashMenuOpen((o) => !o)}
            style={{
              background: '#24242c',
              border: `1px solid ${awBg.line}`,
              borderRadius: 8,
              width: 36,
              height: 32,
              cursor: 'pointer',
              color: '#e6edf3',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⋮
          </button>
          {portfolioCashMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                minWidth: 180,
                background: awBg.card,
                border: `1px solid ${awBg.cardBorder}`,
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                padding: 4,
                zIndex: 10,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPortfolioCashDraft(String(portfolioBrokerCash));
                  setPortfolioCashEditing(true);
                  setPortfolioCashMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#e6edf3',
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cash Depot bearbeiten
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setLevelUpPortfolioOpen((o) => !o)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
            paddingRight: 44,
          }}
          aria-expanded={levelUpPortfolioOpen}
        >
          <div style={{ ...S.row, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#8b949e', width: 14, flexShrink: 0 }} aria-hidden>
                {levelUpPortfolioOpen ? '▼' : '▶'}
              </span>
              <div style={S.label}>💎 Portfolio Power</div>
            </div>
            <div style={{ fontSize: 10, color: '#7d8590' }}>Live</div>
          </div>
        </button>
        <div
          style={{ fontSize: 11, color: '#7d8590', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontWeight: 700 }}
        >
          Gesamt (Positionen + Cash Depot)
        </div>
        <div style={{ ...S.bigNum, color: '#a855f7' }}>{fmt(portfolioTotalPower)}</div>
        <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${awBg.line}` }}>
          <div style={{ fontSize: 11, color: '#7d8590', marginBottom: 4 }}>Cash Depot (nicht investiert)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#c9d1d9' }}>{fmt(portfolioBrokerCash)}</div>
          <div style={{ fontSize: 11, color: '#7d8590', marginTop: 6 }}>Davon investiert (Positionen): {fmt(portfolioValue)}</div>
          {portfolioCashEditing && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              <input
                style={{ ...S.input, width: '100%', maxWidth: 220 }}
                inputMode="decimal"
                autoFocus
                value={portfolioCashDraft}
                onChange={(e) => setPortfolioCashDraft(e.target.value)}
                placeholder="z. B. 1500"
              />
              <button
                type="button"
                style={{ ...S.chip(true), padding: '8px 12px' }}
                onClick={() => {
                  const raw = portfolioCashDraft.replace(/\s/g, '').replace(',', '.');
                  const n = parseFloat(raw);
                  if (Number.isNaN(n) || n < 0) {
                    showToast('Bitte einen gültigen Cash-Wert eingeben.', 'error');
                    return;
                  }
                  setPortfolioBrokerCash(Math.round(n * 100) / 100);
                  setPortfolioCashEditing(false);
                  showToast('Cash Depot aktualisiert ✅');
                }}
              >
                Speichern
              </button>
              <button
                type="button"
                style={{ ...S.chip(false), padding: '8px 12px' }}
                onClick={() => {
                  setPortfolioCashEditing(false);
                  setPortfolioCashDraft('');
                }}
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>
        {levelUpPortfolioOpen && (
          <>
            {(() => {
              const b = portfolioPowerBadgeFor(portfolioTotalPower);
              return b ? (
                <div style={{ fontSize: b.fontSize, fontWeight: b.fontWeight, color: b.color, marginTop: 4 }}>
                  {b.emoji ? `${b.emoji} ` : ''}
                  {b.text}
                </div>
              ) : null;
            })()}
            {renderPortfolioAllocation(true)}
          </>
        )}
      </div>

      {renderMarket({ collapsible: true })}
    </div>
  );

  const renderMarket = (opts?: { collapsible?: boolean }) => {
    const collapsible = opts?.collapsible === true;
    const rows = market.map((m) => {
      const hist = m.historyDaily ?? [];
      const expanded = marketDetailSym === m.sym;
      const range = marketHistoryRange(hist);
      const sparkData = sparkPricesFromHistory(m.historyDaily, m.price);
      const display = instrumentDisplayLines(instrumentMetaForSym(m.sym, market, watchlistExtras));
      return (
        <div key={m.sym} style={{ borderBottom: `1px solid ${awBg.cardBorder}` }}>
          <div style={S.marketRow}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${m.sym}: Kurs und groben Verlauf ${expanded ? 'ausblenden' : 'anzeigen'}`}
              onClick={() => {
                const next = expanded ? null : m.sym;
                setMarketDetailSym(next);
                if (next) void loadMarketHistory(next);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <MarketAssetIcon item={m} size={36} borderRadius={10} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>{display.title}</div>
                <div style={{ fontSize: 11, color: '#7d8590', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {display.subtitle}
                  {display.subtitle ? ' · ' : ''}
                  {expanded ? 'Verlauf ▲' : 'Verlauf ▶'}
                </div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.92,
                  marginLeft: 4,
                  marginRight: 4,
                }}
                title="30-Tage-Verlauf"
              >
                <Spark data={sparkData} color={m.change >= 0 ? '#2563eb' : '#ff7b7b'} />
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 92 }}>
                <div style={{ fontSize: 10, color: '#7d8590', fontWeight: 600, marginBottom: 2 }}>Kurs</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#e6edf3' }}>{m.price > 0 ? fmt(m.price) : '…'}</div>
                <div style={{ fontSize: 12, color: m.change >= 0 ? '#2563eb' : '#ff7b7b', fontWeight: 700, marginTop: 2 }}>
                  {m.change >= 0 ? '▲' : '▼'} {Math.abs(m.change).toFixed(2)}%
                </div>
              </div>
            </button>
            {!BASE_SYM_SET.has(m.sym) ? (
              <button
                type="button"
                aria-label={`${m.sym} aus Watchlist entfernen`}
                onClick={() => {
                  if (marketDetailSym === m.sym) setMarketDetailSym(null);
                  removeWatchlistInstrument(m.sym);
                }}
                style={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: `1px solid ${awBg.line}`,
                  background: '#24242c',
                  color: '#8b949e',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            ) : (
              <div style={{ width: 34, flexShrink: 0 }} aria-hidden />
            )}
          </div>
          {expanded ? (
            <div
              style={{
                padding: '0 4px 12px 46px',
                marginTop: -4,
              }}
            >
              <div style={{ fontSize: 10, color: '#7d8590', marginBottom: 8, lineHeight: 1.45 }}>
                {marketHistoryLoading === m.sym
                  ? 'Kursverlauf wird geladen…'
                  : m.historySource
                    ? `Quelle: ${m.historySource} · 30 Handelstage · Schlusskurse in EUR`
                    : 'Tages-Schlusskurse in EUR'}
                {range ? (
                  <>
                    {' '}
                    · Spanne <strong style={{ color: '#c9d1d9' }}>{fmt(range.min)}</strong> –{' '}
                    <strong style={{ color: '#c9d1d9' }}>{fmt(range.max)}</strong>
                  </>
                ) : null}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '2px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#7d8590',
                  paddingBottom: 4,
                  borderBottom: `1px solid ${awBg.line}`,
                }}
              >
                <span>Datum</span>
                <span style={{ textAlign: 'right' }}>Schluss €</span>
              </div>
              <div style={{ maxHeight: 168, overflowY: 'auto' as const, WebkitOverflowScrolling: 'touch' }}>
                {[...hist].reverse().map((pt) => (
                  <div
                    key={pt.date}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '2px 12px',
                      fontSize: 11,
                      padding: '5px 0',
                      borderBottom: `1px solid ${awBg.cardBorder}`,
                      color: pt.date === todayIsoDate() ? '#e6edf3' : '#8b949e',
                    }}
                  >
                    <span>{formatTxDateLabel(pt.date)}</span>
                    <span style={{ textAlign: 'right', fontWeight: pt.date === todayIsoDate() ? 800 : 600 }}>{fmt(pt.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      );
    });

    const freeCard = (
      <div style={{ ...S.card, border: '1px solid #f8d03a55', background: 'linear-gradient(135deg,#231f0d,#2e2810)' }}>
        <div style={{ ...S.label, color: '#f8d03a' }}>💎 Premium Feature</div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>Live-Marktdaten sind im Finance-Free-Paket gesperrt. Upgrade und ab geht's! 📈</div>
        <button type="button" style={S.btn('#7c3aed')} onClick={() => setTab('profile')}>
          🚀 Jetzt Upgrade ansehen
        </button>
      </div>
    );

    const paidCardInner = (
      <>
        {!collapsible && (
          <div style={{ ...S.row, marginBottom: 4 }}>
            <div style={S.label}>📡 Live Marktdaten</div>
            <div style={{ fontSize: 10, color: '#2563eb' }}>● Live</div>
          </div>
        )}
        {rows}
      </>
    );

    if (collapsible) {
      return (
        <div style={{ marginTop: 10 }}>
          {!isPaidPlan && (
            <div style={{ ...S.card, border: '1px solid #f8d03a55', background: 'linear-gradient(135deg,#231f0d,#2e2810)' }}>
              <button
                type="button"
                onClick={() => setLevelUpMarketOpen((o) => !o)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  marginBottom: levelUpMarketOpen ? 10 : 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                }}
                aria-expanded={levelUpMarketOpen}
              >
                <div style={{ ...S.row, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#8b949e', width: 14, flexShrink: 0 }} aria-hidden>
                      {levelUpMarketOpen ? '▼' : '▶'}
                    </span>
                    <div style={S.label}>📡 Live Marktdaten</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!levelUpLocked ? (
                      <button
                        type="button"
                        aria-label={liveMarketAddOpen ? 'Hinzufügen schließen' : 'Instrument zur Watchlist hinzufügen'}
                        title="Instrument hinzufügen"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLiveMarketAddOpen((o) => {
                            const next = !o;
                            if (next) setOrderInstrumentAddOpen(false);
                            return next;
                          });
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: '1px solid rgba(248, 208, 58, 0.4)',
                          background: 'rgba(248, 208, 58, 0.1)',
                          color: '#f8d03a',
                          fontSize: 20,
                          fontWeight: 900,
                          lineHeight: 1,
                          cursor: 'pointer',
                          flexShrink: 0,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    ) : null}
                    <div style={{ fontSize: 9, color: '#f8d03a', fontWeight: 700 }}>Finance Free</div>
                  </div>
                </div>
              </button>
              {levelUpMarketOpen && (
                <>
                  {!levelUpLocked && liveMarketAddOpen && renderInstrumentAddForm(() => setLiveMarketAddOpen(false), { watchlistOnly: true })}
                  <div style={{ ...S.label, color: '#f8d03a' }}>💎 Premium Feature</div>
                  <div style={{ fontSize: 14, marginBottom: 10 }}>Live-Marktdaten sind im Finance-Free-Paket gesperrt. Upgrade und ab geht's! 📈</div>
                  <button type="button" style={S.btn('#7c3aed')} onClick={() => setTab('profile')}>
                    🚀 Jetzt Upgrade ansehen
                  </button>
                </>
              )}
            </div>
          )}
          {isPaidPlan && (
            <div style={S.card}>
              <button
                type="button"
                onClick={() => setLevelUpMarketOpen((o) => !o)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  marginBottom: levelUpMarketOpen ? 8 : 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                }}
                aria-expanded={levelUpMarketOpen}
              >
                <div style={{ ...S.row, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#8b949e', width: 14, flexShrink: 0 }} aria-hidden>
                      {levelUpMarketOpen ? '▼' : '▶'}
                    </span>
                    <div style={S.label}>📡 Live Marktdaten</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!levelUpLocked ? (
                      <button
                        type="button"
                        aria-label={liveMarketAddOpen ? 'Hinzufügen schließen' : 'Instrument zur Watchlist hinzufügen'}
                        title="Instrument hinzufügen"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLiveMarketAddOpen((o) => {
                            const next = !o;
                            if (next) setOrderInstrumentAddOpen(false);
                            return next;
                          });
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: '1px solid rgba(37, 99, 235, 0.45)',
                          background: 'rgba(37, 99, 235, 0.12)',
                          color: '#93c5fd',
                          fontSize: 20,
                          fontWeight: 900,
                          lineHeight: 1,
                          cursor: 'pointer',
                          flexShrink: 0,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    ) : null}
                    <div style={{ fontSize: 10, color: '#2563eb' }}>● Live</div>
                  </div>
                </div>
              </button>
              {levelUpMarketOpen && (
                <>
                  {!levelUpLocked && liveMarketAddOpen && renderInstrumentAddForm(() => setLiveMarketAddOpen(false), { watchlistOnly: true })}
                  <div style={{ fontSize: 10, color: '#7d8590', marginBottom: 8, lineHeight: 1.45 }}>
                    Kurse in <strong style={{ color: '#c9d1d9' }}>€ je Stück</strong> (CoinGecko / Yahoo Finance, Aktien ggf. USD→EUR). Tagesänderung in
                    %. Zeile antippen für <strong style={{ color: '#c9d1d9' }}>30-Tage-Historie</strong> — Aktualisierung ca. alle 90&nbsp;s.
                  </div>
                  {rows}
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={S.section}>
        {!isPaidPlan && freeCard}
        {isPaidPlan && <div style={S.card}>{paidCardInner}</div>}
      </div>
    );
  };

  const renderProfile = () => (
    <>
      {legalSheet && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            background: 'rgba(3,3,5,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setLegalSheet(null)}
        >
          <div
            style={{
              ...S.card,
              maxWidth: 420,
              width: '100%',
              maxHeight: 'min(86vh, 560px)',
              overflowY: 'auto',
              border: `1px solid ${awBg.line}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ ...S.row, marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {legalSheet === 'impressum' && 'Impressum'}
                {legalSheet === 'rechtlich' && 'Rechtliches'}
                {legalSheet === 'disclaimer' && 'Keine Anlageberatung'}
              </div>
              <button type="button" style={{ ...S.chip(false), padding: '6px 12px' }} onClick={() => setLegalSheet(null)}>
                Schließen
              </button>
            </div>
            {legalSheet === 'impressum' && (
              <div style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.55 }}>
                <p style={{ marginBottom: 10 }}>
                  <strong>Clever Finance</strong> — Informationsangebot zur persönlichen Finanzübersicht (Demo / Entwicklungsstand).
                </p>
                <p style={{ marginBottom: 10 }}>
                  Verantwortlich im Sinne von § 5 TMG (Muster): Clever Finance Demo, Musterstraße 1, 10115 Berlin. Kontakt: support@example.invalid
                </p>
                <p style={{ fontSize: 12, color: '#7d8590' }}>Bitte ersetze diese Platzhalter-Daten durch deine echten Angaben, sobald die App öffentlich geht.</p>
              </div>
            )}
            {legalSheet === 'rechtlich' && (
              <div style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.55 }}>
                <p style={{ marginBottom: 10 }}>
                  Es gelten die Nutzungsbedingungen deines Hosting- und Zahlungsanbieters. In dieser Version werden keine Rechts- oder Steuerberatungen erteilt.
                </p>
                <p style={{ marginBottom: 10 }}>Bei Streitigkeiten zu Abos (Stripe o. Ä.) wende dich bitte an den jeweiligen Anbieter und prüfe deine E-Mail-Bestätigungen.</p>
                <p style={{ fontSize: 12, color: '#7d8590' }}>Für verbindliche AGB / Datenschutzerklärung bitte separate Dokumente einbinden.</p>
              </div>
            )}
            {legalSheet === 'disclaimer' && (
              <div style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.55 }}>
                <p style={{ marginBottom: 10 }}>
                  Die App zeigt Marktdaten, Beispielkurse und Simulationen. Das ist <strong>keine Anlageberatung</strong>, kein Werben für Wertpapiere und keine
                  persönliche Empfehlung (§§ 2, 3 WpIG analog — nur inhaltlicher Hinweis).
                </p>
                <p style={{ marginBottom: 10 }}>Investitionsentscheidungen triffst du allein auf eigene Recherche und Risiko.</p>
              </div>
            )}
          </div>
        </div>
      )}
    <div data-tour="profile-main" style={S.section}>
      <div style={{ ...S.card, border: '1px solid #7c3aed55', marginTop: 6 }}>
        <div style={{ ...S.row }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              Clever <span style={{ color: '#d485ff', fontWeight: 900 }}>Finance</span>
            </div>
            <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4 }}>
              Pakete & Abrechnung — aktuell: {PRICING[subEffective.tier].name}
              {DEV_FORCE_ELITE && sub.tier !== 'elite' && (
                <span style={{ display: 'block', marginTop: 4, color: '#5b93ff', fontSize: 11 }}>
                  Dev: Features wie Elite freigeschaltet (VITE_DEV_FORCE_ELITE=0 zum Abschalten)
                </span>
              )}
            </div>
          </div>
          <button style={{ ...S.chip(true), fontSize: 14 }} onClick={() => setProfileSection('subscription')}>
            ›
          </button>
        </div>
      </div>

      <div style={S.card}>
        {(
          [
            ['personal', '👤 Persönliche Angaben'],
            ['notifications', '🔔 Mitteilungen'],
            ['feedback', '💬 Feedback & Wünsche'],
            ['orden', '🎖️ Meine Orden'],
            ['redeem', '🎁 Code einlösen'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            style={{ ...S.row, width: '100%', background: 'transparent', border: 'none', color: '#e6edf3', padding: '14px 4px', cursor: 'pointer', borderBottom: `1px solid ${awBg.cardBorder}` }}
            onClick={() => setProfileSection(id)}
          >
            <span style={{ fontSize: 20, textAlign: 'left' }}>{label}</span>
            <span style={{ color: '#7d8590', fontSize: 22 }}>›</span>
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.label}>⚖️ Impressum & Hinweise</div>
        <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 10 }}>Kurzinfos — bitte vor Go-live durch echte Texte deines Unternehmens ersetzen.</div>
        {(
          [
            ['impressum', '📋 Impressum'],
            ['rechtlich', '📜 Rechtliches'],
            ['disclaimer', '⚠️ Keine Anlageberatung'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            style={{ ...S.row, width: '100%', background: 'transparent', border: 'none', color: '#e6edf3', padding: '12px 0', cursor: 'pointer', borderBottom: `1px solid ${awBg.cardBorder}` }}
            onClick={() => setLegalSheet(id)}
          >
            <span>{label}</span>
            <span style={{ color: '#7d8590' }}>›</span>
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.label}>🎮 Onboarding</div>
        <div style={{ fontSize: 12, color: '#7d8590', marginTop: 6, lineHeight: 1.5 }}>
          Führung nochmal durchlaufen (deine Daten bleiben erhalten). Mit Account wird der Fortschritt ans Backend mitgeschickt.
        </div>
        <button type="button" style={{ ...S.btn(awBg.mutedBtn), marginTop: 12 }} onClick={restartOnboarding}>
          Onboarding erneut starten
        </button>
        <button type="button" style={{ ...S.btn('#1f3a5f'), marginTop: 8, border: '1px solid #58a6ff66' }} onClick={startAppTour}>
          🗺️ App-Tour mit Licht & Sprechblase
        </button>
      </div>

      {profileSection === 'subscription' && (
        <>
          {PUBLIC_BETA && (
            <div style={{ ...S.card, border: '1px solid #58a6ff66', background: '#121820' }}>
              <div style={S.label}>🧪 Öffentliche Testphase</div>
              <div style={{ fontSize: 13, color: '#c9d1d9', marginTop: 8, lineHeight: 1.55 }}>
                Bis auf Weiteres ist <strong>alles kostenlos</strong> — alle Funktionen (inkl. LevelUp) sind freigeschaltet. Es gibt in dieser Phase
                kein Bezahlen und keine Abo-Upgrades.
              </div>
            </div>
          )}
          {!PUBLIC_BETA && (
          <div style={S.card}>
            <div style={S.label}>🔁 Abrechnungszyklus</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...S.chip(sub.cycle === 'monthly'), flex: 1, padding: '10px 8px' }} onClick={() => setSub((prev) => ({ ...prev, cycle: 'monthly' }))}>
                Monatlich
              </button>
              <button style={{ ...S.chip(sub.cycle === 'yearly'), flex: 1, padding: '10px 8px' }} onClick={() => setSub((prev) => ({ ...prev, cycle: 'yearly' }))}>
                Jährlich (-20%)
              </button>
            </div>
          </div>
          )}

          {!PUBLIC_BETA && (Object.keys(PRICING) as SubscriptionTier[]).map((tier) => {
            const plan = PRICING[tier];
            const active = tier === subEffective.tier;
            return (
              <div key={tier} style={{ ...S.card, border: active ? '1px solid #2563eb88' : `1px solid ${awBg.cardBorder}` }}>
                <div style={{ ...S.row, marginBottom: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{plan.name}</div>
                  <div style={{ fontWeight: 700, color: tier === 'free' ? '#7d8590' : '#2563eb' }}>
                    {plan[sub.cycle].toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 10 }}>{sub.cycle === 'monthly' ? 'pro Monat' : 'pro Jahr'}</div>
                <div style={{ fontSize: 12, marginBottom: 10 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ marginBottom: 4 }}>
                      ✅ {f}
                    </div>
                  ))}
                </div>
                <button
                  style={S.btn(active ? awBg.mutedBtn : '#2563eb')}
                  onClick={() => void changePlan(tier)}
                  disabled={active || upgradeLoading}
                >
                  {active
                    ? '✅ Aktueller Plan'
                    : tier === 'free'
                      ? `🛑 Abo kündigen (${PRICING.free.name})`
                      : upgradeLoading
                        ? '⏳ Weiterleitung...'
                        : `🔥 Auf ${plan.name} upgraden`}
                </button>
              </div>
            );
          })}
          {PUBLIC_BETA && (
            <div style={S.card}>
              <div style={S.label}>✅ Dein Zugang in der Beta</div>
              <div style={{ fontSize: 13, color: '#7d8590', marginTop: 8, lineHeight: 1.5 }}>
                Du nutzt alle Features ohne Limit. Nach der Testphase informieren wir euch, falls kostenpflichtige Pakete kommen.
              </div>
            </div>
          )}
        </>
      )}

      {profileSection === 'personal' && (
        <div style={S.card}>
          <div style={S.label}>👤 Persönliche Angaben</div>
          <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 8 }}>E-Mail: {authUser?.email}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ ...S.input, padding: '10px 12px', fontSize: 14 }}
              placeholder="Nutzername"
              value={profileNameDraft}
              onChange={(e) => setProfileNameDraft(e.target.value)}
            />
            <button style={{ ...S.chip(true), padding: '8px 12px' }} onClick={() => void saveProfileName()} disabled={profileSaving}>
              {profileSaving ? '...' : '💾'}
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 6 }}>Geschlecht (freiwillig, für Statistik / Personalisierung)</div>
            <select style={S.select} value={profileGender} onChange={(e) => setProfileGender(e.target.value)}>
              <option value="">— keine Angabe</option>
              <option value="m">männlich</option>
              <option value="w">weiblich</option>
              <option value="d">divers</option>
            </select>
          </div>
        </div>
      )}

      {profileSection === 'feedback' && (
        <div style={{ ...S.card, border: '1px solid #58a6ff55' }}>
          <div style={S.label}>💬 Feedback & Wünsche</div>
          <div style={{ fontSize: 12, color: '#7d8590', marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
            Was funktioniert nicht? Was können wir besser machen? Was wünschst du dir noch? Dein Text geht direkt an uns (Beta).
          </div>
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, fontWeight: 700 }}>Kategorie</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {(
              [
                ['bug', '🐛 Funktioniert nicht'],
                ['improve', '✨ Verbesserung'],
                ['feature', '💡 Wunsch / Feature'],
                ['other', '💬 Sonstiges'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                style={{
                  ...S.chip(feedbackKind === id),
                  padding: '8px 12px',
                  fontSize: 12,
                  flex: '1 1 auto',
                  minWidth: 'calc(50% - 4px)',
                }}
                onClick={() => setFeedbackKind(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, fontWeight: 700 }}>Deine Nachricht</div>
          <textarea
            style={{
              ...S.input,
              width: '100%',
              minHeight: 140,
              resize: 'vertical' as const,
              lineHeight: 1.45,
              fontFamily: 'inherit',
            }}
            placeholder="z. B. Sync zwischen iPhone und PC, fehlende Funktion, Idee für Boost …"
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            maxLength={8000}
          />
          <div style={{ fontSize: 11, color: '#6e7681', marginTop: 6, textAlign: 'right' as const }}>
            {feedbackMessage.trim().length} / 8000
          </div>
          <button
            type="button"
            style={{ ...S.btn('#2563eb'), marginTop: 12, opacity: feedbackSending ? 0.7 : 1 }}
            onClick={() => void submitFeedback()}
            disabled={feedbackSending}
          >
            {feedbackSending ? '⏳ Wird gesendet…' : '📨 Feedback absenden'}
          </button>
        </div>
      )}

      {profileSection === 'notifications' && (
        <div style={S.card}>
          <div style={S.label}>🔔 Mitteilungseinstellungen</div>
          {[
            ['suspiciousCharges', 'Verdächtige Abbuchungen'],
            ['subscriptionChanges', 'Abo-Änderungen'],
            ['weeklySummary', 'Wöchentliche Zusammenfassung'],
          ].map(([k, label]) => (
            <button
              key={k}
              style={{ ...S.row, width: '100%', background: 'transparent', border: 'none', color: '#e6edf3', padding: '12px 0', cursor: 'pointer' }}
              onClick={() => setNotifSettings((prev) => ({ ...prev, [k]: !(prev as any)[k] }))}
            >
              <span>{label}</span>
              <span>{(notifSettings as any)[k] ? '✅' : '⬜'}</span>
            </button>
          ))}
        </div>
      )}

      {profileSection === 'orden' && (
        <div style={{ ...S.card, border: '1px solid #7c3aed44' }}>
          <div style={{ ...S.row, marginBottom: 8, alignItems: 'flex-start' }}>
            <div>
              <div style={S.label}>🎖️ Meine Orden</div>
              <div style={{ fontSize: 12, color: '#7d8590', marginTop: 6, lineHeight: 1.5 }}>
                Diese Liste kommt vom Creator. Sobald du etwas erreichst, wird der entsprechende Orden automatisch freigeschaltet und eingefärbt — noch nicht Erreichte bleiben grau.
              </div>
            </div>
            <div
              style={{
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 800,
                padding: '6px 10px',
                borderRadius: 8,
                background: '#21262d',
                color: '#a855f7',
                border: `1px solid ${awBg.line}`,
              }}
            >
              {earnedOrdenPresetIds.length}/{ORDEN_CATALOG.length}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ORDEN_CATALOG.map((orden) => {
              const unlocked = earnedOrdenPresetIds.includes(orden.presetId);
              return (
                <div
                  key={orden.presetId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 12px',
                    borderRadius: 12,
                    border: unlocked ? '1px solid rgba(168, 85, 247, 0.45)' : `1px solid ${awBg.cardBorder}`,
                    background: unlocked ? 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(12,17,35,0.95) 100%)' : '#21262d',
                    boxShadow: unlocked ? '0 0 0 1px rgba(168,85,247,0.08), 0 8px 24px rgba(0,0,0,0.25)' : 'none',
                  }}
                >
                  <div style={{ fontSize: 34, lineHeight: 1, filter: unlocked ? 'none' : 'grayscale(0.92)', opacity: unlocked ? 1 : 0.55 }}>
                    {orden.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: unlocked ? 800 : 600,
                        color: unlocked ? '#e6edf3' : '#6e7681',
                        letterSpacing: unlocked ? -0.2 : undefined,
                      }}
                    >
                      {orden.title}
                    </div>
                    <div style={{ fontSize: 11, color: unlocked ? '#a855f7' : '#484f58', marginTop: 4, fontWeight: 700 }}>
                      {unlocked ? '● Freigeschaltet' : '○ Noch nicht erreicht'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {profileSection === 'redeem' && (
        <div style={S.card}>
          <div style={S.label}>🎁 Code einlösen</div>
          <input
            style={S.input}
            placeholder="Code eingeben (z.B. CLEVERPRO)"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
          />
          <button style={S.btn()} onClick={applyRedeemCode}>
            ✨ Einlösen
          </button>
        </div>
      )}
    </div>
    </>
  );

  if (authLoading) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={S.card}>Lade Benutzerkonto... ⏳</div>
      </div>
    );
  }

  if (!authUser && authGate === 'welcome') {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ ...S.card, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <CleverFinanceLogo size={104} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', marginTop: 8, lineHeight: 1.35 }}>
            Schön, dass du hier bist!
          </div>
          <div style={{ fontSize: 15, color: '#7d8590', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
            Meistere kinderleicht deine Finanzen.
          </div>
          <button type="button" style={{ ...S.btn(), marginTop: 20 }} onClick={() => setAuthGate('auth')}>
            Mit E-Mail, Google oder Apple anmelden
          </button>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ ...S.card, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <CleverFinanceLogo size={96} />
          </div>
          <div style={{ fontSize: 13, color: '#7d8590', marginBottom: 12 }}>
            {authMode === 'register'
              ? 'Neues Konto — danach kurze Fragen (ca. 5 Min.), dann führt dich eine Tour mit Licht & Sprechblase durch die App. 🎉'
              : 'Willkommen zurück — melde dich mit E-Mail und Passwort an.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button style={{ ...S.chip(authMode === 'login'), flex: 1 }} onClick={() => setAuthMode('login')}>
              🔐 Anmelden
            </button>
            <button
              style={{ ...S.chip(authMode === 'register'), flex: 1 }}
              onClick={() => setAuthMode('register')}
            >
              ✍️ Registrieren
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {authMode === 'register' && (
              <input style={S.input} placeholder="Name" value={authForm.name} onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))} />
            )}
            <input style={S.input} type="email" placeholder="E-Mail" value={authForm.email} onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))} />
            <input style={S.input} type="password" placeholder="Passwort" value={authForm.password} onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} />
            {authError && <div style={{ fontSize: 12, color: '#ff7b7b' }}>{authError}</div>}
            <button style={S.btn()} onClick={() => void submitAuth()}>
              {authMode === 'login' ? '🚀 Jetzt anmelden' : '🎉 Konto erstellen'}
            </button>
            <div style={{ ...S.row, gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, height: 1, background: awBg.line }} />
              <div style={{ fontSize: 11, color: '#7d8590' }}>oder</div>
              <div style={{ flex: 1, height: 1, background: awBg.line }} />
            </div>
            <div ref={googleBtnRef} />
            {!googleUiReady && GOOGLE_CLIENT_ID && (
              <button style={S.btn(awBg.mutedBtn)} onClick={reloadGoogleUi}>
                🔄 Google erneut laden
              </button>
            )}
            {googleUiFailed && (
              <>
                <div style={{ fontSize: 11, color: '#ff7b7b' }}>
                  Google Button konnte nicht geladen werden. Deaktiviere ggf. Adblock/Shield oder nutze den Fallback unten.
                </div>
                <button style={S.btn(awBg.mutedBtn)} onClick={startGoogleRedirectLogin}>
                  🔐 Mit Google im Browser fortfahren
                </button>
              </>
            )}
            <button
              style={{ ...S.btn('#111'), border: '1px solid #ffffff33' }}
              onClick={() => void handleAppleLogin()}
              disabled={!APPLE_CLIENT_ID || !appleReady || appleLoading}
            >
              {appleLoading ? '⏳ Apple startet...' : '🍏 Weiter mit Apple'}
            </button>
            {!GOOGLE_CLIENT_ID && (
              <div style={{ fontSize: 11, color: '#7d8590' }}>Google Login aktivieren mit `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID`.</div>
            )}
            {!APPLE_CLIENT_ID && (
              <div style={{ fontSize: 11, color: '#7d8590' }}>Apple Login aktivieren mit `VITE_APPLE_CLIENT_ID` + `APPLE_CLIENT_ID`.</div>
            )}
            {APPLE_CLIENT_ID && !appleReady && (
              <div style={{ fontSize: 11, color: '#7d8590' }}>Apple Script wird geladen... ggf. Seite neu laden.</div>
            )}
            <button
              type="button"
              onClick={() => setAuthGate('welcome')}
              style={{
                marginTop: 14,
                width: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#5b93ff',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              ← Zurück zum Willkommen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authUser && !cloudUserStateReady) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={S.card}>Synchronisiere deine Daten… ⏳</div>
      </div>
    );
  }

  if (authUser && cloudUserStateReady && !onboardingDone) {
    return (
      <div key={wizardRemount}>
        {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}
        <OnboardingWizard onComplete={completeOnboarding} />
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background-color:${awBg.appFallback};background-image:${awBg.app};background-attachment:fixed;min-height:100vh}`}</style>

      {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}

      <DebtZeroVictoryOverlay open={debtVictoryOpen} onClose={() => setDebtVictoryOpen(false)} />
      <NotgroschenFullOverlay open={notgroschenVictoryOpen} onClose={() => setNotgroschenVictoryOpen(false)} />
      <AppGuideTour open={appTourOpen} steps={appTourSteps} onClose={closeAppTour} onTabChange={setTab} />
      <PortfolioPowerMilestoneOverlay
        open={portfolioMilestoneOpen}
        milestone={portfolioMilestoneKind}
        onClose={dismissPortfolioMilestone}
      />

      <div style={S.header}>
        <div style={{ ...S.row }}>
          <div>
            <CleverFinanceLogo />
            <div style={S.sub}>Deine Finanzen. Clever gedacht.</div>
            <div style={{ fontSize: 12, color: '#d0d7de', marginTop: 6, fontWeight: 700 }}>👤 {authUser.name || authUser.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#7d8590' }}>
              {MONTHS[calMonth0]} {reportYear}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: saldo >= 0 ? '#2563eb' : '#ff7b7b' }}>
              {saldo >= 0 ? '+' : ''}
              {fmt(saldo)}
            </div>
            <button style={{ ...S.chip(false), marginTop: 8 }} onClick={logout}>
              👋 Logout
            </button>
          </div>
        </div>
      </div>

      {tab === 'dashboard' && renderDashboard()}
      {tab === 'transactions' && renderTransactions()}
      {tab === 'charts' && renderCharts()}
      {tab === 'debts' && renderDebts()}
      {tab === 'invest' && renderInvest()}
      {tab === 'profile' && renderProfile()}

      <div data-tour="tab-bar" style={S.tabBar}>
        {tabsVisible.map((t) => (
          <button key={t.id} data-tour={`tab-${t.id}`} style={S.tabItem(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={S.tabIcon}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
