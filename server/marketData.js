/**
 * Live-Marktdaten: CoinGecko (Krypto, EUR) + Yahoo Finance (Aktien/ETFs, ggf. USD→EUR).
 */

const CRYPTO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOT: 'polkadot',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
  BNB: 'binancecoin',
};

/** Bekannte Symbole → Yahoo-Ticker (EUR-Listings wo sinnvoll). */
const STOCK_TICKERS = {
  AAPL: 'AAPL',
  SPY: 'SPY',
  MSCI: 'IWDA.AS',
  MSFT: 'MSFT',
  NVDA: 'NVDA',
  TSLA: 'TSLA',
  SAP: 'SAP.DE',
  VOW3: 'VOW3.DE',
};

const cache = {
  cgId: new Map(),
  history: new Map(),
  usdEur: { rate: null, at: 0 },
};

const HISTORY_TTL_MS = 15 * 60_000;
const USD_EUR_TTL_MS = 60 * 60_000;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'CleverFinance/1.0 (market-data)',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return res.json();
}

function roundPrice(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return v >= 100 ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000;
}

async function getUsdToEur() {
  const now = Date.now();
  if (cache.usdEur.rate && now - cache.usdEur.at < USD_EUR_TTL_MS) {
    return cache.usdEur.rate;
  }
  const data = await fetchJson('https://api.frankfurter.app/latest?from=USD&to=EUR');
  const rate = data?.rates?.EUR;
  if (!rate) throw new Error('USD/EUR-Kurs nicht verfügbar');
  cache.usdEur = { rate, at: now };
  return rate;
}

async function resolveCoingeckoId(sym) {
  const upper = String(sym || '').toUpperCase();
  if (CRYPTO_IDS[upper]) return CRYPTO_IDS[upper];
  if (cache.cgId.has(upper)) return cache.cgId.get(upper);
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`,
  );
  const coins = Array.isArray(data?.coins) ? data.coins : [];
  const match =
    coins.find((c) => String(c.symbol || '').toUpperCase() === upper) ||
    coins.find((c) => String(c.id || '').toLowerCase() === String(sym).toLowerCase()) ||
    coins[0];
  const id = match?.id || null;
  if (id) cache.cgId.set(upper, id);
  return id;
}

function resolveYahooTicker(sym) {
  const upper = String(sym || '').toUpperCase();
  return STOCK_TICKERS[upper] || sym;
}

async function fetchCryptoQuotes(items) {
  const idBySym = {};
  const ids = [];
  for (const { sym } of items) {
    const id = await resolveCoingeckoId(sym);
    if (!id) continue;
    idBySym[String(sym).toUpperCase()] = id;
    if (!ids.includes(id)) ids.push(id);
  }
  if (!ids.length) return {};
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=eur&include_24hr_change=true`,
  );
  const out = {};
  for (const [sym, id] of Object.entries(idBySym)) {
    const row = data[id];
    if (row?.eur == null) continue;
    out[sym] = {
      price: roundPrice(row.eur),
      change: row.eur_24h_change != null ? Math.round(row.eur_24h_change * 100) / 100 : 0,
      currency: 'EUR',
      source: 'CoinGecko',
    };
  }
  return out;
}

async function fetchYahooQuote(sym) {
  const ticker = resolveYahooTicker(sym);
  const data = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
  );
  const result = data?.chart?.result?.[0];
  if (!result?.meta) throw new Error(`Keine Yahoo-Daten für ${ticker}`);
  const meta = result.meta;
  const currency = meta.currency || 'USD';
  let price = meta.regularMarketPrice ?? meta.previousClose;
  if (price == null) throw new Error(`Kein Kurs für ${ticker}`);
  let change = 0;
  if (meta.regularMarketPrice != null && meta.chartPreviousClose) {
    change = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
  } else if (meta.regularMarketChangePercent != null) {
    change = meta.regularMarketChangePercent;
  }
  let source = 'Yahoo Finance';
  if (currency === 'USD') {
    price *= await getUsdToEur();
    source = 'Yahoo Finance · USD→EUR (Frankfurter/EZB)';
  } else if (currency !== 'EUR') {
    source = `Yahoo Finance (${currency})`;
  }
  return {
    price: roundPrice(price),
    change: Math.round(change * 100) / 100,
    currency: currency === 'USD' || currency === 'EUR' ? 'EUR' : currency,
    source,
  };
}

async function fetchStockQuotes(items) {
  const out = {};
  for (const { sym } of items) {
    try {
      out[String(sym).toUpperCase()] = await fetchYahooQuote(sym);
    } catch (e) {
      console.warn(`[market] quote ${sym}:`, e.message);
    }
  }
  return out;
}

function dailyHistoryFromPairs(pairs, days, eurMult = 1) {
  const byDate = new Map();
  for (const [ts, p] of pairs) {
    if (p == null || Number.isNaN(p)) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
    const price = roundPrice(p * eurMult);
    if (price != null) byDate.set(date, price);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([date, price]) => ({ date, price }));
}

async function fetchCryptoHistory(sym, days) {
  const id = await resolveCoingeckoId(sym);
  if (!id) throw new Error(`Krypto-Symbol unbekannt: ${sym}`);
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=eur&days=${days}`,
  );
  const prices = Array.isArray(data?.prices) ? data.prices : [];
  if (!prices.length) throw new Error('Kein Kursverlauf');
  return {
    history: dailyHistoryFromPairs(prices, days, 1),
    currency: 'EUR',
    source: 'CoinGecko',
  };
}

async function fetchYahooHistory(sym, days) {
  const ticker = resolveYahooTicker(sym);
  const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y';
  const data = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`,
  );
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`Kein Verlauf für ${ticker}`);
  const currency = result.meta?.currency || 'USD';
  let eurMult = 1;
  let source = 'Yahoo Finance';
  if (currency === 'USD') {
    eurMult = await getUsdToEur();
    source = 'Yahoo Finance · USD→EUR (Frankfurter/EZB)';
  } else if (currency !== 'EUR') {
    source = `Yahoo Finance (${currency})`;
  }
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const pairs = timestamps.map((ts, i) => [ts * 1000, closes[i]]);
  const history = dailyHistoryFromPairs(pairs, days, eurMult);
  if (!history.length) throw new Error('Leerer Verlauf');
  return { history, currency: currency === 'USD' ? 'EUR' : currency, source };
}

export function mountMarketRoutes(app) {
  app.post('/api/market/quotes', async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ error: 'items erforderlich' });
      if (items.length > 40) return res.status(400).json({ error: 'max. 40 Instrumente' });
      const crypto = items.filter((i) => i.kind === 'crypto');
      const stocks = items.filter((i) => i.kind !== 'crypto');
      const [cq, sq] = await Promise.all([fetchCryptoQuotes(crypto), fetchStockQuotes(stocks)]);
      return res.json({
        quotes: { ...cq, ...sq },
        fetchedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[market] quotes:', e.message);
      return res.status(502).json({ error: 'Marktdaten vorübergehend nicht verfügbar.' });
    }
  });

  app.post('/api/market/history', async (req, res) => {
    try {
      const sym = String(req.body?.sym || '').trim();
      const kind = req.body?.kind === 'crypto' ? 'crypto' : 'stock';
      const days = Math.min(365, Math.max(7, Number(req.body?.days) || 30));
      if (!sym) return res.status(400).json({ error: 'sym erforderlich' });
      const cacheKey = `${sym.toUpperCase()}:${kind}:${days}`;
      const cached = cache.history.get(cacheKey);
      if (cached && Date.now() - cached.at < HISTORY_TTL_MS) {
        return res.json(cached.data);
      }
      const data = kind === 'crypto' ? await fetchCryptoHistory(sym, days) : await fetchYahooHistory(sym, days);
      const payload = { sym: sym.toUpperCase(), days, ...data };
      cache.history.set(cacheKey, { data: payload, at: Date.now() });
      return res.json(payload);
    } catch (e) {
      console.error('[market] history:', e.message);
      return res.status(502).json({ error: 'Kursverlauf vorübergehend nicht verfügbar.' });
    }
  });
}
