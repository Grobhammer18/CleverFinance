/** Grober simulierter Tagesverlauf je Asset (keine echten Börsendaten). */
export type MarketDailyPrice = { date: string; price: number };

export const MARKET_HISTORY_DAYS = 30;

function symSeed(sym: string): number {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
  return h || 1;
}

/** Letzte `days` Kalendertage mit grob simulierten Schlusskursen (älteste zuerst). */
export function generateRoughDailyHistory(sym: string, endPrice: number, days = MARKET_HISTORY_DAYS): MarketDailyPrice[] {
  const seed = symSeed(sym);
  let s = seed;
  const rnd = () => {
    s = (s * 48271) % 2147483647;
    return (s % 10000) / 10000;
  };
  const prices: number[] = [endPrice];
  for (let i = 1; i < days; i++) {
    const drift = (rnd() - 0.48) * 0.04;
    prices.unshift(+(prices[0]! * (1 - drift)).toFixed(2));
  }
  const today = new Date();
  return prices.map((price, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return { date: d.toISOString().slice(0, 10), price };
  });
}

export function ensureMarketDailyHistory(
  sym: string,
  price: number,
  existing?: MarketDailyPrice[],
): MarketDailyPrice[] {
  if (existing?.length) return existing;
  return generateRoughDailyHistory(sym, price);
}

/** Live-Tick: heutigen Eintrag aktualisieren oder neuen Tag anhängen. */
export function updateMarketDailyHistory(
  history: MarketDailyPrice[] | undefined,
  sym: string,
  newPrice: number,
  days = MARKET_HISTORY_DAYS,
): MarketDailyPrice[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  let h = ensureMarketDailyHistory(sym, newPrice, history);
  const last = h[h.length - 1];
  if (last?.date === todayIso) {
    h = [...h.slice(0, -1), { date: todayIso, price: newPrice }];
  } else {
    h = [...h, { date: todayIso, price: newPrice }];
    if (h.length > days) h = h.slice(-days);
  }
  return h;
}

export function sparkPricesFromHistory(history: MarketDailyPrice[] | undefined, fallbackPrice: number, points = 14): number[] {
  const src = history?.length ? history : [{ date: '', price: fallbackPrice }];
  return src.slice(-points).map((p) => p.price);
}

export function marketHistoryRange(history: MarketDailyPrice[]): { min: number; max: number } | null {
  if (!history.length) return null;
  let min = history[0]!.price;
  let max = history[0]!.price;
  for (const p of history) {
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
  }
  return { min, max };
}
