/** Grundwährung der App (Money / Home). */
export const BASE_CURRENCY = 'EUR';

export type MoneyCurrency = {
  code: string;
  label: string;
  symbol: string;
};

/** Häufige Reise- & Nachbarwährungen (Frankfurter / EZB). */
export const MONEY_CURRENCIES: MoneyCurrency[] = [
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'USD', label: 'US-Dollar', symbol: '$' },
  { code: 'GBP', label: 'Britisches Pfund', symbol: '£' },
  { code: 'CHF', label: 'Schweizer Franken', symbol: 'CHF' },
  { code: 'PLN', label: 'Polnischer Złoty', symbol: 'zł' },
  { code: 'CZK', label: 'Tschechische Krone', symbol: 'Kč' },
  { code: 'SEK', label: 'Schwedische Krone', symbol: 'kr' },
  { code: 'NOK', label: 'Norwegische Krone', symbol: 'kr' },
  { code: 'DKK', label: 'Dänische Krone', symbol: 'kr' },
  { code: 'HUF', label: 'Ungarischer Forint', symbol: 'Ft' },
  { code: 'RON', label: 'Rumänischer Leu', symbol: 'lei' },
  { code: 'TRY', label: 'Türkische Lira', symbol: '₺' },
  { code: 'THB', label: 'Thailändischer Baht', symbol: '฿' },
  { code: 'JPY', label: 'Japanischer Yen', symbol: '¥' },
  { code: 'CNY', label: 'Chinesischer Yuan', symbol: '¥' },
  { code: 'AUD', label: 'Australischer Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Kanadischer Dollar', symbol: 'C$' },
  { code: 'MXN', label: 'Mexikanischer Peso', symbol: 'MX$' },
  { code: 'BRL', label: 'Brasilianischer Real', symbol: 'R$' },
  { code: 'INR', label: 'Indische Rupie', symbol: '₹' },
  { code: 'AED', label: 'VAE-Dirham', symbol: 'د.إ' },
  { code: 'ZAR', label: 'Südafrikanischer Rand', symbol: 'R' },
];

const CURRENCY_SYMBOL = new Map(MONEY_CURRENCIES.map((c) => [c.code, c.symbol]));

export function moneyCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOL.get(code) || code;
}

export function moneyCurrencyOptionLabel(code: string): string {
  const c = MONEY_CURRENCIES.find((x) => x.code === code);
  return c ? `${c.code} (${c.label})` : code;
}

export function formatForeignPaidLine(amount: number, currency: string): string {
  const sym = moneyCurrencySymbol(currency);
  const n = Number(amount);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : String(amount);
  return `Gezahlt: ${formatted} ${sym}`;
}

export type FxRateQuote = { eurPerUnit: number; date: string };

/** 1 Einheit `from` → EUR (EZB-Tageskurs via Frankfurter). */
export async function fetchEurRate(from: string, billingApi: string): Promise<FxRateQuote> {
  const code = String(from || '').trim().toUpperCase();
  if (!code || code === BASE_CURRENCY) {
    return { eurPerUnit: 1, date: new Date().toISOString().slice(0, 10) };
  }
  const viaApi = billingApi
    ? `${billingApi.replace(/\/$/, '')}/api/fx/rate?from=${encodeURIComponent(code)}`
    : `https://api.frankfurter.app/latest?from=${encodeURIComponent(code)}&to=${BASE_CURRENCY}`;
  const res = await fetch(viaApi);
  if (!res.ok) throw new Error('fx-unavailable');
  const data = (await res.json()) as { eurPerUnit?: number; rates?: { EUR?: number }; date?: string };
  const eurPerUnit =
    typeof data.eurPerUnit === 'number' && data.eurPerUnit > 0
      ? data.eurPerUnit
      : typeof data.rates?.EUR === 'number' && data.rates.EUR > 0
        ? data.rates.EUR
        : NaN;
  if (!Number.isFinite(eurPerUnit) || eurPerUnit <= 0) throw new Error('fx-parse');
  return { eurPerUnit, date: typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10) };
}

export function convertForeignToEur(foreignAmount: number, eurPerUnit: number): number {
  return Math.round(foreignAmount * eurPerUnit * 100) / 100;
}
