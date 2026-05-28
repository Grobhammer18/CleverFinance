import type { DailyVermogenSnapshot } from '../components/homeCharts/homeChartData';

/**
 * Musterdaten Jan–Apr (Beispieljahr 2026) für Tab „Übersicht“ / Diagramme.
 * Enthält feste **Tages-Snapshots**, damit sofort die tägliche Kurve erscheint (nicht erst nach mehreren Kalendertagen).
 */

export const OVERVIEW_DEMO_DEBT_ID = 91001;

/** Kurz erklärender Text neben dem Demo-Button */
export const OVERVIEW_DEMO_HINT =
  'Überschreibt Schulden, Money-Buchungen, Notgroschen-, Cash-Depot-Stand und die gespeicherte Tages-Übersicht; Orders werden geleert. Bei Login: Sync ins Konto möglich.';

type DemoDebt = {
  id: number;
  name: string;
  total: number;
  remaining: number;
  interest: number;
  monthly: number;
  kind?: 'consumer' | 'house';
  archivedAt?: string;
};

type DemoTx = {
  id: number;
  type: 'einnahme' | 'ausgabe';
  amount: string;
  category: string;
  note: string;
  date: string;
  paymentMethod?: string;
  linkedDebtId?: number;
  linkedDebtName?: string;
  fillsNotgroschen?: boolean;
  debitsNotgroschen?: boolean;
  debitsCashDepot?: boolean;
  creditsCashDepot?: boolean;
};

type DemoTrade = {
  id: string;
  at: string;
  kind: 'buy' | 'sell';
  sym: string;
  amount: number;
  pricePerShareEur?: number;
  totalEur?: number;
};

/** Illustrierende Tagespunkte (Jan–Apr 2026): gleiche Richtung wie die Demo-Buchungen; letzter Tag = aktueller Endstand nach Money. */
function demoDailySnapshots2026(): DailyVermogenSnapshot[] {
  const rows = [
    { date: '2026-01-15', notgroschen: 3750, portfolioPlusCash: 11_200, schulden: 18_800 },
    { date: '2026-01-31', notgroschen: 4000, portfolioPlusCash: 12_000, schulden: 18_000 },
    { date: '2026-02-15', notgroschen: 4100, portfolioPlusCash: 12_400, schulden: 17_600 },
    { date: '2026-02-28', notgroschen: 4200, portfolioPlusCash: 12_800, schulden: 17_200 },
    { date: '2026-03-15', notgroschen: 4300, portfolioPlusCash: 13_100, schulden: 16_800 },
    { date: '2026-03-31', notgroschen: 4400, portfolioPlusCash: 13_500, schulden: 16_400 },
    { date: '2026-04-15', notgroschen: 4500, portfolioPlusCash: 13_900, schulden: 16_000 },
    /** Letzter Demo-Stichtag = gleicher Endstand wie notgroschenBalance / Depot / Schulden nach Buchungen */
    { date: '2026-04-29', notgroschen: 4600, portfolioPlusCash: 14_200, schulden: 15_600 },
  ];
  return rows.map((r) => {
    const saldoKomplett = Math.round((r.notgroschen + r.portfolioPlusCash - r.schulden) * 100) / 100;
    return { ...r, saldoKomplett };
  });
}

export function getOverviewDemoSnapshot(): {
  debts: DemoDebt[];
  transactions: DemoTx[];
  notgroschenBalance: number;
  portfolioBrokerCash: number;
  portfolioTrades: DemoTrade[];
  dailyVermogenSnapshots: DailyVermogenSnapshot[];
} {
  const DID = OVERVIEW_DEMO_DEBT_ID;
  const name = 'Demo Autokredit';

  const debts: DemoDebt[] = [
    {
      id: DID,
      name,
      total: 20_000,
      remaining: 15_600,
      interest: 4.5,
      monthly: 280,
      kind: 'consumer',
    },
  ];

  const transactions: DemoTx[] = [
    {
      id: 926_001,
      type: 'ausgabe',
      amount: '800',
      category: 'Kreditrate',
      note: 'Demo Rate',
      date: '2026-01-28',
      paymentMethod: 'Überweisung',
      linkedDebtId: DID,
      linkedDebtName: name,
    },
    {
      id: 926_002,
      type: 'ausgabe',
      amount: '200',
      category: 'Notgroschen',
      note: 'Demo Sparrate',
      date: '2026-01-28',
      paymentMethod: 'Überweisung',
      fillsNotgroschen: true,
    },
    {
      id: 926_003,
      type: 'ausgabe',
      amount: '800',
      category: 'Sonstiges',
      note: 'Demo Einzahlung Depot',
      date: '2026-01-28',
      paymentMethod: 'Einzahlung Cash Depot',
      creditsCashDepot: true,
    },
    {
      id: 926_004,
      type: 'ausgabe',
      amount: '800',
      category: 'Kreditrate',
      note: 'Demo Rate',
      date: '2026-02-26',
      paymentMethod: 'Überweisung',
      linkedDebtId: DID,
      linkedDebtName: name,
    },
    {
      id: 926_005,
      type: 'ausgabe',
      amount: '200',
      category: 'Notgroschen',
      note: 'Demo Sparrate',
      date: '2026-02-26',
      paymentMethod: 'Überweisung',
      fillsNotgroschen: true,
    },
    {
      id: 926_006,
      type: 'ausgabe',
      amount: '800',
      category: 'Sonstiges',
      note: 'Demo Einzahlung Depot',
      date: '2026-02-26',
      paymentMethod: 'Einzahlung Cash Depot',
      creditsCashDepot: true,
    },
    {
      id: 926_007,
      type: 'ausgabe',
      amount: '800',
      category: 'Kreditrate',
      note: 'Demo Rate',
      date: '2026-03-28',
      paymentMethod: 'Überweisung',
      linkedDebtId: DID,
      linkedDebtName: name,
    },
    {
      id: 926_008,
      type: 'ausgabe',
      amount: '200',
      category: 'Notgroschen',
      note: 'Demo Sparrate',
      date: '2026-03-28',
      paymentMethod: 'Überweisung',
      fillsNotgroschen: true,
    },
    {
      id: 926_009,
      type: 'ausgabe',
      amount: '700',
      category: 'Sonstiges',
      note: 'Demo Einzahlung Depot',
      date: '2026-03-28',
      paymentMethod: 'Einzahlung Cash Depot',
      creditsCashDepot: true,
    },
    {
      id: 926_010,
      type: 'ausgabe',
      amount: '950',
      category: 'Miete',
      note: 'Warmmiete Demo',
      date: '2026-03-03',
      paymentMethod: 'Überweisung',
    },
    {
      id: 926_011,
      type: 'ausgabe',
      amount: '800',
      category: 'Kreditrate',
      note: 'Demo Rate',
      date: '2026-04-26',
      paymentMethod: 'Überweisung',
      linkedDebtId: DID,
      linkedDebtName: name,
    },
    {
      id: 926_012,
      type: 'ausgabe',
      amount: '200',
      category: 'Notgroschen',
      note: 'Demo Sparrate',
      date: '2026-04-26',
      paymentMethod: 'Überweisung',
      fillsNotgroschen: true,
    },
    {
      id: 926_013,
      type: 'ausgabe',
      amount: '700',
      category: 'Sonstiges',
      note: 'Demo Einzahlung Depot',
      date: '2026-04-26',
      paymentMethod: 'Einzahlung Cash Depot',
      creditsCashDepot: true,
    },
    {
      id: 926_014,
      type: 'ausgabe',
      amount: '15.99',
      category: 'Abos',
      note: 'Streaming Demo',
      date: '2026-04-05',
      paymentMethod: 'Lastschrift',
    },
    {
      id: 926_015,
      type: 'ausgabe',
      amount: '42.50',
      category: 'Essen & Trinken',
      note: 'Einkauf Demo',
      date: '2026-04-12',
      paymentMethod: 'Kreditkarte',
    },
  ];

  return {
    debts,
    transactions,
    notgroschenBalance: 4600,
    portfolioBrokerCash: 14_200,
    portfolioTrades: [],
    dailyVermogenSnapshots: demoDailySnapshots2026(),
  };
}
