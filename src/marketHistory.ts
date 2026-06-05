/** Tages-Schlusskurse je Asset (vom Server: CoinGecko / Yahoo). */
export type MarketDailyPrice = { date: string; price: number };

export const MARKET_HISTORY_DAYS = 30;

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
