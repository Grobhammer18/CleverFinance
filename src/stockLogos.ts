/** FMP-Aktienlogo — US-Ticker (MSFT) funktionieren; Xetra-Kürzel (MSF-DE) oft nicht. */
export function fmpStockLogoUrl(sym: string): string {
  return `https://financialmodelingprep.com/image-stock/${sym.replace(/\./g, '-')}.png`;
}

function fmpStockLogoDotUrl(sym: string): string {
  return `https://financialmodelingprep.com/image-stock/${sym}.png`;
}

function companiesMarketCapLogoUrl(ticker: string): string {
  const base = ticker.split('.')[0]!.toUpperCase();
  return `https://companiesmarketcap.com/img/company-logos/64/${base}.webp`;
}

/**
 * Mehrere Logo-URLs — MarketAssetIcon probiert nacheinander (onError).
 * `usTicker`: bei ISIN-Auflösung oft MSFT statt MSF.DE.
 */
export function stockLogoUrlCandidates(sym: string, opts?: { usTicker?: string }): string[] {
  const s = sym.toUpperCase().trim();
  const out: string[] = [];
  const add = (url: string) => {
    if (url && !out.includes(url)) out.push(url);
  };

  const us = opts?.usTicker?.toUpperCase().trim();
  if (us) {
    add(fmpStockLogoUrl(us));
    add(fmpStockLogoDotUrl(us));
    add(companiesMarketCapLogoUrl(us));
  }

  const dot = s.indexOf('.');
  const base = dot >= 0 ? s.slice(0, dot) : s;
  const exchange = dot >= 0 ? s.slice(dot + 1) : '';

  if (exchange && ['PA', 'AS', 'L', 'SW', 'MI'].includes(exchange)) {
    add(fmpStockLogoDotUrl(s));
  }

  if (exchange) {
    add(fmpStockLogoUrl(base));
    add(companiesMarketCapLogoUrl(base));
  }

  add(fmpStockLogoUrl(s));

  return out;
}
