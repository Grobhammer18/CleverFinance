export type ChartTx = {
  id: number;
  type: 'einnahme' | 'ausgabe';
  amount: string;
  category: string;
  date: string;
  fillsNotgroschen?: boolean;
  debitsNotgroschen?: boolean;
  debitsCashDepot?: boolean;
  creditsCashDepot?: boolean;
  linkedDebtId?: number;
};

export type ChartDebt = {
  id: number;
  remaining: number;
  total: number;
  kind?: 'consumer' | 'house';
  propertyValue?: number;
};

/** Summe Marktwerte offener Hauskredite (Boost). */
export function sumImmobilienMarktwert(debts: ChartDebt[]): number {
  return (
    Math.round(
      debts
        .filter((d) => d.kind === 'house' && d.remaining > 0.001)
        .reduce((s, d) => {
          const pv =
            typeof d.propertyValue === 'number' && !Number.isNaN(d.propertyValue) && d.propertyValue > 0
              ? d.propertyValue
              : 0;
          return s + pv;
        }, 0) * 100,
    ) / 100
  );
}

export function saldoKomplettFromParts(
  notgroschen: number,
  portfolioPlusCash: number,
  schulden: number,
  immobilienWert: number,
): number {
  return Math.round((notgroschen + portfolioPlusCash + immobilienWert - schulden) * 100) / 100;
}

export type ChartPortfolioTrade = {
  id: string;
  at: string;
  kind: 'buy' | 'sell';
  sym: string;
  amount: number;
  pricePerShareEur?: number;
  totalEur?: number;
};

export type PieSlice = { name: string; value: number };

function parseAmt(amount: string): number {
  const n = parseFloat(String(amount ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function tradeOrderEur(t: ChartPortfolioTrade): number | null {
  if (typeof t.totalEur === 'number' && !Number.isNaN(t.totalEur) && t.totalEur >= 0) return t.totalEur;
  const p = t.pricePerShareEur;
  if (typeof p === 'number' && !Number.isNaN(p) && p > 0) return t.amount * p;
  return null;
}

/** ISO oder TT.MM.JJJJ */
export function parseTxTimeMs(dateStr: string): number {
  const s = String(dateStr || '').trim();
  if (!s) return 0;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) {
    const day = +de[1];
    const month = +de[2];
    const year = +de[3];
    return new Date(year, month - 1, Math.min(day, 28), 12).getTime();
  }
  return 0;
}

function parseTradeTimeMs(at: string): number {
  const m = String(at || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12).getTime();
  const t = Date.parse(at);
  return Number.isNaN(t) ? 0 : t;
}

function ngDelta(tx: ChartTx): number {
  const amt = parseAmt(tx.amount);
  if (tx.fillsNotgroschen) return amt;
  if (tx.debitsNotgroschen) return -amt;
  return 0;
}

function cashDelta(tx: ChartTx): number {
  const amt = parseAmt(tx.amount);
  if (tx.debitsCashDepot) return -amt;
  if (tx.creditsCashDepot) return amt;
  if (tx.type === 'einnahme' && tx.category === 'Dividende') return amt;
  return 0;
}

function tradeBrokerCashDelta(t: ChartPortfolioTrade): number {
  const eu = tradeOrderEur(t);
  if (eu == null) return 0;
  return t.kind === 'buy' ? -eu : eu;
}

function ymKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

function ymKeyFromMs(ms: number): string | null {
  if (!ms || Number.isNaN(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return ymKey(d.getFullYear(), d.getMonth());
}

function monthKeysInclusive(startYm: string, endYm: string, maxMonths: number): string[] {
  const parseYm = (k: string) => {
    const [yr, mo] = k.split('-').map(Number);
    return { y: yr!, m0: mo! - 1 };
  };
  const start = parseYm(startYm);
  const end = parseYm(endYm);
  const seq: string[] = [];
  let y = start.y;
  let m0 = start.m0;
  const endIdx = end.y * 12 + end.m0;
  let guard = 0;
  while (y * 12 + m0 <= endIdx && guard++ < 120) {
    seq.push(ymKey(y, m0));
    m0++;
    if (m0 > 11) {
      m0 = 0;
      y++;
    }
  }
  if (seq.length > maxMonths) return seq.slice(-maxMonths);
  return seq;
}

export function monthKeyLabelDe(ymKeyStr: string): string {
  const [yRaw, moRaw] = ymKeyStr.split('-');
  const NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const y = +yRaw;
  const mo = +moRaw;
  if (!y || mo < 1 || mo > 12) return ymKeyStr;
  return `${NAMES[mo - 1]} ${y}`;
}

function endOfMonthMs(ymKeyStr: string): number {
  const [yRaw, moRaw] = ymKeyStr.split('-').map(Number);
  if (!yRaw || !moRaw) return Date.now();
  return new Date(yRaw, moRaw, 0, 23, 59, 59).getTime();
}

export type WealthLinePt = {
  ym: string;
  label: string;
  notgroschen: number;
  portfolioPlusCash: number;
  /** Marktwert Immobilien (Hauskredite in Boost) */
  immobilienWert: number;
  schulden: number;
  /** Notgroschen + Portfolio + Immobilien − Schulden */
  saldoKomplett: number;
};

export type SimpleLinePt = { ym: string; label: string; value: number };

const MAX_HISTORY_MONTHS = 36;

/** Ein Eintrag pro Kalendertag: Live-Stand beim Speichern (Portfolio inkl. Kurse, NG, Schulden). */
export type DailyVermogenSnapshot = {
  date: string;
  notgroschen: number;
  portfolioPlusCash: number;
  /** Summe Marktwert Hauskredite (optional, ältere Snapshots: 0) */
  immobilienWert?: number;
  schulden: number;
  saldoKomplett: number;
};

export const MAX_DAILY_VERMOGEN_SNAPSHOTS = 400;

export function normalizeDailyVermogenSnapshots(raw: unknown): DailyVermogenSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyVermogenSnapshot[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const dateRaw = typeof o.date === 'string' ? o.date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : '';
    if (!date) continue;
    const pick = (k: string): number => {
      const v = o[k];
      if (typeof v !== 'number' || Number.isNaN(v)) return 0;
      return Math.round(v * 100) / 100;
    };
    const notgroschen = pick('notgroschen');
    const portfolioPlusCash = pick('portfolioPlusCash');
    const schulden = pick('schulden');
    const immobilienWert = pick('immobilienWert');
    const saldoKomplett =
      typeof o.saldoKomplett === 'number' && !Number.isNaN(o.saldoKomplett)
        ? Math.round(o.saldoKomplett * 100) / 100
        : saldoKomplettFromParts(notgroschen, portfolioPlusCash, schulden, immobilienWert);
    out.push({ date, notgroschen, portfolioPlusCash, immobilienWert, schulden, saldoKomplett });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(-MAX_DAILY_VERMOGEN_SNAPSHOTS);
}

/** Späteres Datum aus „jetzt“ und letztem Datenpunkt (Buchungen, Orders, Tages‑Snapshots) — gemeinsame Jahresbasis für Home‑Balken und Übersicht. */
export function inferChartTimelineEndMs(
  transactions: ChartTx[],
  portfolioTrades: ChartPortfolioTrade[],
  dailySnapshots: unknown,
): number {
  let peak = Date.now();
  for (const t of transactions) {
    const ms = parseTxTimeMs(t.date);
    if (ms > peak) peak = ms;
  }
  for (const tr of portfolioTrades) {
    const ms = parseTradeTimeMs(tr.at);
    if (ms > peak) peak = ms;
  }
  for (const s of normalizeDailyVermogenSnapshots(dailySnapshots)) {
    const ms = parseTxTimeMs(s.date);
    if (ms > peak) peak = ms;
  }
  return peak;
}

export type ResolvedChartSeries = {
  wealth: WealthLinePt[];
  portfolioOnly: SimpleLinePt[];
  /** Monatsanzahl oder Tagesanzahl (je nach Reihe). */
  spanCount: number;
  isDailySnapshotSeries: boolean;
};

/** Sobald ≥2 gültige Tages-Snapshots: Diagramme über Tage; sonst weiter Monatsrekonstruktion. */
export function resolveHomeChartSeries(
  transactions: ChartTx[],
  debts: ChartDebt[],
  notgroschenBalance: number,
  portfolioBrokerCash: number,
  portfolioTrades: ChartPortfolioTrade[],
  marketPrices: Record<string, number>,
  dailySnapshots: DailyVermogenSnapshot[],
): ResolvedChartSeries {
  const timelineEndMs = inferChartTimelineEndMs(transactions, portfolioTrades, dailySnapshots);
  const anchorYear = new Date(timelineEndMs).getFullYear();
  const snaps = normalizeDailyVermogenSnapshots(dailySnapshots);
    if (snaps.length >= 2) {
    const wealth: WealthLinePt[] = [];
    const portfolioOnly: SimpleLinePt[] = [];
    for (const s of snaps) {
      const [y, mo, d] = s.date.split('-').map(Number);
      if (!y || !mo || !d) continue;
      const label = new Date(y, mo - 1, d).toLocaleDateString(
        'de-DE',
        y !== anchorYear ? { day: 'numeric', month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' },
      );
      const immo = s.immobilienWert ?? 0;
      const saldo = saldoKomplettFromParts(s.notgroschen, s.portfolioPlusCash, s.schulden, immo);
      wealth.push({
        ym: s.date,
        label,
        notgroschen: s.notgroschen,
        portfolioPlusCash: s.portfolioPlusCash,
        immobilienWert: immo,
        schulden: s.schulden,
        saldoKomplett: saldo,
      });
      portfolioOnly.push({ ym: s.date, label, value: s.portfolioPlusCash });
    }
    if (wealth.length >= 2) {
      return { wealth, portfolioOnly, spanCount: snaps.length, isDailySnapshotSeries: true };
    }
  }
  const m = buildHomeChartSeries(
    transactions,
    debts,
    notgroschenBalance,
    portfolioBrokerCash,
    portfolioTrades,
    marketPrices,
    timelineEndMs,
  );
  return {
    wealth: m.wealth,
    portfolioOnly: m.portfolioOnly,
    spanCount: m.monthSpan,
    isDailySnapshotSeries: false,
  };
}

/** Aus Buchungen & Orders rekonstruiert — manuelle Änderungen (z. B. Notgroschen/Cash ohne Buchung) weichen möglicherweise ab. */
export function buildHomeChartSeries(
  transactions: ChartTx[],
  debts: ChartDebt[],
  notgroschenBalance: number,
  portfolioBrokerCash: number,
  portfolioTrades: ChartPortfolioTrade[],
  marketPrices: Record<string, number>,
  /** Gemeinsamer End-Anker mit Home (max. Jetzt vs. neuester Buchung/Snapshot); sonst echtes Datum. */
  timelineEndMs?: number,
): {
  wealth: WealthLinePt[];
  portfolioOnly: SimpleLinePt[];
  monthSpan: number;
} {
  const endAnchorMs = timelineEndMs != null && Number.isFinite(timelineEndMs) ? timelineEndMs : Date.now();
  const endD = new Date(endAnchorMs);
  const endYm = ymKey(endD.getFullYear(), endD.getMonth());

  let minMs = Number.POSITIVE_INFINITY;
  for (const t of transactions) {
    const x = parseTxTimeMs(t.date);
    if (x > 0) minMs = Math.min(minMs, x);
  }
  for (const tr of portfolioTrades) {
    const x = parseTradeTimeMs(tr.at);
    if (x > 0) minMs = Math.min(minMs, x);
  }
  if (!Number.isFinite(minMs)) {
    minMs = new Date(endD.getFullYear(), endD.getMonth() - 5, 1).getTime();
  }
  const rawStartYm = ymKeyFromMs(minMs) ?? endYm;
  let months = monthKeysInclusive(rawStartYm, endYm, MAX_HISTORY_MONTHS);

  /** --- Notgroschen month-end (forward from derived start) --- */
  const ngSumRecorded = transactions.reduce((s, t) => s + ngDelta(t), 0);
  let ngRunning = Math.max(0, notgroschenBalance - ngSumRecorded);
  const sortedTxsAsc = [...transactions].sort((a, b) => parseTxTimeMs(a.date) - parseTxTimeMs(b.date) || a.id - b.id);
  let txI = 0;

  /** --- Broker cash baseline --- */
  const cashFromTxSum = transactions.reduce((s, t) => s + cashDelta(t), 0);
  const cashFromTradesSum = portfolioTrades.reduce((s, tr) => s + tradeBrokerCashDelta(tr), 0);

  /** --- Replay portfolio holdings (chronological trades), value with current px --- */
  const tradesAsc = [...portfolioTrades].sort((a, b) => parseTradeTimeMs(a.at) - parseTradeTimeMs(b.at) || a.id.localeCompare(b.id));

  /** --- Schulden Tilg nach Monat (für backward-Rekonstruktion) --- */
  const tilgByMonth = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'ausgabe' || t.category !== 'Kreditrate' || !t.linkedDebtId) continue;
    const km = ymKeyFromMs(parseTxTimeMs(t.date));
    if (!km) continue;
    tilgByMonth.set(km, (tilgByMonth.get(km) ?? 0) + parseAmt(t.amount));
  }

  /** backward debt remaining baseline per month ending */
  const debtNow = debts.reduce((s, d) => s + Math.max(0, d.remaining), 0);
  const immobilienWertNow = sumImmobilienMarktwert(debts);

  const wealth: WealthLinePt[] = [];
  const portfolioOnly: SimpleLinePt[] = [];
  const debtRemain: SimpleLinePt[] = [];

  let tradeIdx = 0;
  /** Broker-Cash ohne Positionsbewertung: Start + Buchungen bis Monatsende */
  let cashAcc = portfolioBrokerCash - cashFromTxSum - cashFromTradesSum;

  let heldAccum: Record<string, number> = {};

  for (const mk of months) {
    const boundary = endOfMonthMs(mk);
    while (txI < sortedTxsAsc.length && parseTxTimeMs(sortedTxsAsc[txI].date) <= boundary) {
      const row = sortedTxsAsc[txI]!;
      ngRunning += ngDelta(row);
      cashAcc += cashDelta(row);
      txI++;
    }
    while (tradeIdx < tradesAsc.length && parseTradeTimeMs(tradesAsc[tradeIdx].at) <= boundary) {
      const tr = tradesAsc[tradeIdx]!;
      cashAcc += tradeBrokerCashDelta(tr);
      const prev = heldAccum[tr.sym] ?? 0;
      if (tr.kind === 'buy') heldAccum[tr.sym] = prev + tr.amount;
      else heldAccum[tr.sym] = Math.max(0, prev - tr.amount);
      tradeIdx++;
    }

    let invested = 0;
    for (const sym of Object.keys(heldAccum)) {
      const qty = heldAccum[sym] ?? 0;
      const px = marketPrices[sym] ?? 0;
      invested += qty * px;
    }
    const portfolioPlusCash = Math.max(0, invested + Math.max(0, cashAcc));

    wealth.push({
      ym: mk,
      label: monthKeyLabelDe(mk),
      notgroschen: Math.round(Math.max(0, ngRunning) * 100) / 100,
      portfolioPlusCash: Math.round(portfolioPlusCash * 100) / 100,
      immobilienWert: immobilienWertNow,
      schulden: 0,
      saldoKomplett: 0,
    });
    portfolioOnly.push({
      ym: mk,
      label: monthKeyLabelDe(mk),
      value: Math.round(portfolioPlusCash * 100) / 100,
    });
  }

  /** debt series: march backward tilg by month map */
  let rem = debtNow;
  for (let i = months.length - 1; i >= 0; i--) {
    const mk = months[i]!;
    debtRemain.push({
      ym: mk,
      label: monthKeyLabelDe(mk),
      value: Math.round(Math.max(0, rem) * 100) / 100,
    });
    rem += tilgByMonth.get(mk) ?? 0;
  }
  debtRemain.reverse();
  for (let i = 0; i < months.length; i++) {
    const w = wealth[i]!;
    w.schulden = Math.round(Math.max(0, debtRemain[i]?.value ?? 0) * 100) / 100;
    w.immobilienWert = immobilienWertNow;
    w.saldoKomplett = saldoKomplettFromParts(w.notgroschen, w.portfolioPlusCash, w.schulden, w.immobilienWert);
  }

  return { wealth, portfolioOnly, monthSpan: months.length };
}
