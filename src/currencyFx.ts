/** Standard-Grundwährung (Fallback). */
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

const CURRENCY_BY_CODE = new Map(MONEY_CURRENCIES.map((c) => [c.code, c]));

export function normalizeBaseCurrency(code: unknown): string {
  const c = String(code || '').trim().toUpperCase();
  return CURRENCY_BY_CODE.has(c) ? c : BASE_CURRENCY;
}

export function moneyCurrencySymbol(code: string): string {
  return CURRENCY_BY_CODE.get(code)?.symbol || code;
}

export function moneyCurrencyLabel(code: string): string {
  return CURRENCY_BY_CODE.get(code)?.label || code;
}

export function moneyCurrencyOptionLabel(code: string): string {
  const c = CURRENCY_BY_CODE.get(code);
  return c ? `${c.code} (${c.label})` : code;
}

export function formatMoneyAmount(n: number, currencyCode: string = BASE_CURRENCY): string {
  const code = normalizeBaseCurrency(currencyCode);
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: code }).format(n);
  } catch {
    return `${n.toLocaleString('de-DE')} ${moneyCurrencySymbol(code)}`;
  }
}

export function formatForeignPaidLine(amount: number, currency: string): string {
  const sym = moneyCurrencySymbol(currency);
  const n = Number(amount);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : String(amount);
  return `Gezahlt: ${formatted} ${sym}`;
}

export type FxRateQuote = { basePerUnit: number; date: string; from: string; to: string };

/** 1 Einheit `from` → `to` (EZB-Tageskurs via Frankfurter). */
export async function fetchFxRate(from: string, to: string, billingApi: string): Promise<FxRateQuote> {
  const fromCode = normalizeBaseCurrency(from);
  const toCode = normalizeBaseCurrency(to);
  if (fromCode === toCode) {
    return { from: fromCode, to: toCode, basePerUnit: 1, date: new Date().toISOString().slice(0, 10) };
  }
  const q = `from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(toCode)}`;
  const viaApi = billingApi
    ? `${billingApi.replace(/\/$/, '')}/api/fx/rate?${q}`
    : `https://api.frankfurter.app/latest?${q}`;
  const res = await fetch(viaApi);
  if (!res.ok) throw new Error('fx-unavailable');
  const data = (await res.json()) as {
    basePerUnit?: number;
    eurPerUnit?: number;
    rates?: Record<string, number>;
    date?: string;
    to?: string;
  };
  const target = data.to || toCode;
  const basePerUnit =
    typeof data.basePerUnit === 'number' && data.basePerUnit > 0
      ? data.basePerUnit
      : typeof data.eurPerUnit === 'number' && data.eurPerUnit > 0
        ? data.eurPerUnit
        : typeof data.rates?.[target] === 'number' && data.rates[target] > 0
          ? data.rates[target]
          : NaN;
  if (!Number.isFinite(basePerUnit) || basePerUnit <= 0) throw new Error('fx-parse');
  return {
    from: fromCode,
    to: toCode,
    basePerUnit,
    date: typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10),
  };
}

/** @deprecated Alias — nutzt fetchFxRate mit Ziel EUR. */
export async function fetchEurRate(from: string, billingApi: string): Promise<{ eurPerUnit: number; date: string }> {
  const q = await fetchFxRate(from, BASE_CURRENCY, billingApi);
  return { eurPerUnit: q.basePerUnit, date: q.date };
}

export function convertForeignToBase(foreignAmount: number, basePerUnit: number): number {
  return Math.round(foreignAmount * basePerUnit * 100) / 100;
}

/** @deprecated Alias */
export function convertForeignToEur(foreignAmount: number, eurPerUnit: number): number {
  return convertForeignToBase(foreignAmount, eurPerUnit);
}
