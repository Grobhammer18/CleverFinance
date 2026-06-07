/** Reine Logik für Zweige & LevelUp-Modus (ohne React). */

export type FinanceWho = 'alone' | 'partner' | 'delegate';

export type DebtKind = 'consumer' | 'house';

export type WizardDebtRow = {
  name: string;
  total: number;
  monthly: number;
  kind: DebtKind;
};

export type EmergencyDraft = {
  has: boolean;
  balance: number;
  monthlyContribution: number;
};

export type LevelUpMode = 'full' | 'until_all_debts' | 'until_emergency_half';

/** Optional: voller Positionswert (Kaufpreis×Menge) auf ein Watchlist-Symbol legen; leer = automatische Verteilung */
export type InvestDetailStock = { name: string; buyPrice: number; qty: number; mapSym?: string };
export type InvestDetailCrypto = { name: string; buyPrice: number; qty: number; mapSym?: string };
export type InvestDetailImmo = {
  ortPlz: string;
  strasse: string;
  kaufpreis: number;
  wohnflaeche: number;
  kaltmiete: number;
  nebenkosten: number;
  letzteErhebung: string;
  zyklusJahre: string;
  mapSym?: string;
};
export type InvestDetailP2P = { gesamt: number; profitPct: number; mapSym?: string };

export type InvestDraft = {
  experienced: boolean | null;
  topics: string[];
  approxInvested: number;
  monthlyWant: number;
  risk: '' | 'low' | 'mid' | 'high';
  /** Wenn approxInvested === 0: gewünschte Anlageklassen */
  desiredClasses: string[];
  /** Wenn approxInvested > 0: gehaltene Klassen */
  heldClasses: string[];
  sonstigesTopic: string;
  stocks: InvestDetailStock[];
  crypto: InvestDetailCrypto[];
  immo: InvestDetailImmo[];
  p2p: InvestDetailP2P[];
};

export type OnboardingV2Payload = {
  financeWho: FinanceWho;
  /** Gewählte Grundwährung (ISO-Code, z. B. EUR). */
  baseCurrency: string;
  netIncomeMonthly: number;
  hasDebt: boolean;
  debtKinds: { consumer: boolean; house: boolean };
  debts: WizardDebtRow[];
  emergency: EmergencyDraft;
  investSkipped: boolean;
  levelUpMode: LevelUpMode;
  invest: InvestDraft | null;
  whyHere: string[];
};

function isLevelUpMode(m: unknown): m is LevelUpMode {
  return m === 'full' || m === 'until_all_debts' || m === 'until_emergency_half';
}

/** LevelUp-Modus nach Reload: v2/Server/Cache, sonst konservativ aus Schuld-Art ableiten. */
export function resolveLevelUpMode(args: {
  fromV2?: LevelUpMode | null;
  fromServer?: LevelUpMode | null;
  fromCache?: LevelUpMode | null;
  debts: { remaining: number; kind?: string }[];
  /** Für Migration: nur Hauskredit → kein LevelUp-Lock mehr. */
  debtKinds?: { consumer: boolean; house: boolean };
}): LevelUpMode {
  const { fromV2, fromServer, fromCache, debts, debtKinds } = args;
  const houseOnlyOnboarding = Boolean(debtKinds?.house && !debtKinds?.consumer);

  const normalizeLegacyMode = (mode: LevelUpMode): LevelUpMode => {
    if (mode === 'until_emergency_half' && houseOnlyOnboarding) return 'full';
    return mode;
  };

  if (isLevelUpMode(fromV2)) return normalizeLegacyMode(fromV2);
  if (isLevelUpMode(fromServer)) return normalizeLegacyMode(fromServer);
  if (isLevelUpMode(fromCache)) return normalizeLegacyMode(fromCache);

  const open = debts.filter((d) => d.remaining > 0);
  if (!open.length) return 'full';

  const hasConsumerOpen = open.some((d) => d.kind !== 'house');
  if (hasConsumerOpen) return 'until_all_debts';

  const hasHouseOpen = open.some((d) => d.kind === 'house');
  if (hasHouseOpen) return 'full';

  return 'until_all_debts';
}

export function computeBranch(args: {
  hasDebt: boolean;
  debtKinds: { consumer: boolean; house: boolean };
  emergencyHas: boolean;
}): { investSkipped: boolean; levelUpMode: LevelUpMode } {
  const { hasDebt, debtKinds, emergencyHas } = args;
  const hasConsumer = hasDebt && debtKinds.consumer;
  const hasHouseOnly = hasDebt && debtKinds.house && !debtKinds.consumer;

  if (!hasDebt) {
    return { investSkipped: false, levelUpMode: 'full' };
  }

  /** Konsum ohne Notgroschen: LevelUp gesperrt bis schuldenfrei. */
  if (hasConsumer && !emergencyHas) {
    return { investSkipped: true, levelUpMode: 'until_all_debts' };
  }

  /**
   * Nur Hauskredit: LevelUp bleibt offen (Hypothek blockiert ETFs nicht).
   * Ohne Notgroschen nur die Investment-Fragen im Wizard überspringen.
   */
  if (hasHouseOnly && !emergencyHas) {
    return { investSkipped: true, levelUpMode: 'full' };
  }

  return { investSkipped: false, levelUpMode: 'full' };
}

export function notgroschenTargetFromIncome(netMonthly: number): number {
  const n = Math.max(0, netMonthly);
  return Math.round(n * 2.5 * 100) / 100;
}

/** Mindestpreis für Division (falls Marktdaten fehlen). */
export type MarketPriceRow = { sym: string; price: number };

/**
 * Mappt Onboarding-Invest auf die Watchlist-Symbole (BTC, ETH, SPY, AAPL, MSCI).
 * Pro Zeile optional `mapSym`: gesamter Zeilenwert (EUR) geht 1:1 auf dieses Symbol.
 * Ohne `mapSym`: wie zuvor automatische Verteilung (Aktien-Mix, Krypto 55/45, …).
 */
export function sharesFromOnboardingInvest(inv: InvestDraft, market: MarketPriceRow[]): Record<string, number> | null {
  if (!market.length) return null;
  const price: Record<string, number> = {};
  for (const m of market) price[m.sym] = m.price > 0 ? m.price : 1;

  const eur: Record<string, number> = {};
  for (const m of market) eur[m.sym] = 0;

  const add = (sym: string, v: number) => {
    if (!sym || v <= 0 || !(sym in eur)) return;
    eur[sym] += v;
  };

  const eqSplit = (amount: number) => {
    add('SPY', amount * 0.38);
    add('MSCI', amount * 0.37);
    add('AAPL', amount * 0.25);
  };

  for (const row of inv.stocks) {
    const v = Math.max(0, row.buyPrice) * Math.max(0, row.qty);
    if (v <= 0) continue;
    const sym = String(row.mapSym || '').trim().toUpperCase();
    if (sym && sym in eur) add(sym, v);
    else eqSplit(v);
  }
  for (const row of inv.crypto) {
    const v = Math.max(0, row.buyPrice) * Math.max(0, row.qty);
    if (v <= 0) continue;
    const sym = String(row.mapSym || '').trim().toUpperCase();
    if (sym && sym in eur) add(sym, v);
    else {
      add('BTC', v * 0.55);
      add('ETH', v * 0.45);
    }
  }
  for (const row of inv.p2p) {
    const v = Math.max(0, row.gesamt);
    if (v <= 0) continue;
    const sym = String(row.mapSym || '').trim().toUpperCase();
    if (sym && sym in eur) add(sym, v);
    else {
      add('SPY', v * 0.35);
      add('MSCI', v * 0.35);
      add('BTC', v * 0.15);
      add('ETH', v * 0.15);
    }
  }
  for (const row of inv.immo) {
    const v = Math.min(Math.max(0, row.kaufpreis) * 0.06, 200_000);
    if (v <= 0) continue;
    const sym = String(row.mapSym || '').trim().toUpperCase();
    if (sym && sym in eur) add(sym, v);
    else {
      add('MSCI', v * 0.55);
      add('SPY', v * 0.45);
    }
  }

  const lineTotal = market.reduce((a, m) => a + (eur[m.sym] ?? 0), 0);
  let headline = Math.max(inv.approxInvested, lineTotal);
  if (headline < 50 && inv.monthlyWant > 0) headline = Math.max(headline, inv.monthlyWant * 12);
  if (headline < 10) return null;

  const rest = Math.max(0, headline - lineTotal);
  if (rest > 0) {
    const baseW = [0.28, 0.12, 0.22, 0.18, 0.2];
    const wRaw = market.map((_, i) => baseW[i] ?? 1 / market.length);
    const wsum = wRaw.reduce((a, b) => a + b, 0) || 1;
    market.forEach((m, i) => {
      add(m.sym, (rest * (wRaw[i] ?? 0)) / wsum);
    });
  }

  const out: Record<string, number> = {};
  for (const m of market) {
    out[m.sym] = (eur[m.sym] ?? 0) / price[m.sym];
  }
  return out;
}
