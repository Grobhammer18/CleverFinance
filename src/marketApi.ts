import type { MarketDailyPrice } from './marketHistory';

export type MarketInstrumentKind = 'crypto' | 'stock';

export type MarketQuoteDto = {
  price: number;
  change: number;
  currency: string;
  source: string;
};

export type MarketHistoryDto = {
  sym: string;
  days: number;
  history: MarketDailyPrice[];
  currency: string;
  source: string;
};

export async function fetchMarketQuotes(
  apiBase: string,
  items: { sym: string; kind: MarketInstrumentKind }[],
): Promise<Record<string, MarketQuoteDto>> {
  const res = await fetch(`${apiBase}/api/market/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Marktdaten nicht verfügbar');
  }
  return (data.quotes as Record<string, MarketQuoteDto>) || {};
}

export type InstrumentResolveDto = {
  sym: string;
  name: string;
  kind: MarketInstrumentKind;
  isin?: string;
  logoUrl?: string;
  logoUrlFallbacks?: string[];
  resolved: boolean;
};

export async function fetchInstrumentResolve(
  apiBase: string,
  input: string,
  kind: MarketInstrumentKind,
  nameHint?: string,
): Promise<InstrumentResolveDto> {
  const res = await fetch(`${apiBase}/api/market/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, kind, name: nameHint }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Auflösung fehlgeschlagen');
  }
  return data as InstrumentResolveDto;
}

export async function fetchMarketHistory(
  apiBase: string,
  sym: string,
  kind: MarketInstrumentKind,
  days = 30,
): Promise<MarketHistoryDto> {
  const res = await fetch(`${apiBase}/api/market/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sym, kind, days }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Kursverlauf nicht verfügbar');
  }
  return data as MarketHistoryDto;
}
