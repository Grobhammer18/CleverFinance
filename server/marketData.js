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

function isIsinCode(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s);
}

function formatSecurityName(raw) {
  if (!raw) return '';
  const cleaned = String(raw)
    .replace(/\s*-\s*registered\b.*$/i, '')
    .replace(/\s+registered\b.*$/i, '')
    .trim();
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((w) =>
      w
        .split('-')
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ''))
        .join('-'),
    )
    .join(' ')
    .replace(/\bAg\b/g, 'AG')
    .replace(/\bSe\b/g, 'SE')
    .replace(/\bEtf\b/g, 'ETF')
    .replace(/\bNv\b/g, 'NV')
    .replace(/\bDe\b$/g, 'DE');
}

function looksLikeTickerName(name, sym) {
  const n = String(name || '').trim().toUpperCase();
  const s = String(sym || '').trim().toUpperCase();
  if (!n || n === s) return true;
  return /^[A-Z0-9]{1,6}(\.[A-Z]{1,3})?$/.test(n);
}

function pickBestSecurityName(rows, sym) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const candidates = rows
    .map((r) => formatSecurityName(r.name || ''))
    .filter((n) => n.length > 2 && !looksLikeTickerName(n, sym));
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || '';
}

async function lookupSecurityNameFromYahoo(sym) {
  try {
    const ticker = resolveYahooTicker(sym);
    const data = await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
    );
    const meta = data?.chart?.result?.[0]?.meta;
    const raw = meta?.longName || meta?.shortName;
    const name = raw ? formatSecurityName(raw) : '';
    return name && !looksLikeTickerName(name, sym) ? name : '';
  } catch {
    return '';
  }
}

async function lookupSecurityNameFromOpenFigi(sym) {
  const s = String(sym || '').toUpperCase().trim();
  const dot = s.indexOf('.');
  const base = dot >= 0 ? s.slice(0, dot) : s;
  const exchange = dot >= 0 ? s.slice(dot + 1) : '';
  const exchBySuffix = { DE: 'GR', PA: 'PA', AS: 'AS', L: 'LN', SW: 'SW', MI: 'IM' };
  const jobs = [];
  if (exchange && exchBySuffix[exchange]) {
    jobs.push({ idType: 'TICKER', idValue: base, exchCode: exchBySuffix[exchange] });
  }
  jobs.push({ idType: 'TICKER', idValue: dot >= 0 ? base : s, exchCode: 'US' });
  if (!exchange) jobs.push({ idType: 'TICKER', idValue: s });

  try {
    const data = await fetchJson('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobs.slice(0, 3)),
    });
    if (!Array.isArray(data)) return '';
    for (const batch of data) {
      const row = batch?.data?.[0];
      const name = row?.name ? formatSecurityName(row.name) : '';
      if (name && !looksLikeTickerName(name, sym)) return name;
    }
  } catch {
    /* optional */
  }
  return '';
}

async function lookupSecurityName(sym) {
  const yahoo = await lookupSecurityNameFromYahoo(sym);
  if (yahoo) return yahoo;
  return lookupSecurityNameFromOpenFigi(sym);
}

function yahooTickerFromFigi(row) {
  const t = row?.ticker;
  if (!t) return null;
  const ex = row.exchCode;
  if (['GR', 'GF', 'GD', 'GS', 'GB', 'GT'].includes(ex)) return `${t}.DE`;
  if (ex === 'LN') return `${t}.L`;
  if (ex === 'PA') return `${t}.PA`;
  if (ex === 'AS') return `${t}.AS`;
  if (ex === 'SW') return `${t}.SW`;
  if (ex === 'IM') return `${t}.MI`;
  return t;
}

function stockLogoUrl(sym) {
  return `https://financialmodelingprep.com/image-stock/${String(sym).replace(/\./g, '-')}.png`;
}

function stockLogoDotUrl(sym) {
  return `https://financialmodelingprep.com/image-stock/${String(sym)}.png`;
}

function companiesMarketCapLogoUrl(ticker) {
  const base = String(ticker).split('.')[0].toUpperCase();
  return `https://companiesmarketcap.com/img/company-logos/64/${base}.webp`;
}

/** Mehrere Logo-URLs — US-Ticker zuerst (MSF.DE → MSFT), dann Basis ohne Börse (MOH.DE → MOH). */
function stockLogoUrlCandidates(sym, opts = {}) {
  const s = String(sym || '')
    .toUpperCase()
    .trim();
  const out = [];
  const add = (url) => {
    if (url && !out.includes(url)) out.push(url);
  };

  const us = opts.usTicker ? String(opts.usTicker).toUpperCase().trim() : '';
  if (us) {
    add(stockLogoUrl(us));
    add(stockLogoDotUrl(us));
    add(companiesMarketCapLogoUrl(us));
  }

  const dot = s.indexOf('.');
  const base = dot >= 0 ? s.slice(0, dot) : s;
  const exchange = dot >= 0 ? s.slice(dot + 1) : '';

  if (exchange && ['PA', 'AS', 'L', 'SW', 'MI'].includes(exchange)) {
    add(stockLogoDotUrl(s));
  }

  if (exchange) {
    add(stockLogoUrl(base));
    add(companiesMarketCapLogoUrl(base));
  }

  add(stockLogoUrl(s));
  return out;
}

function stockLogoFields(sym, opts = {}) {
  const urls = stockLogoUrlCandidates(sym, opts);
  return { logoUrl: urls[0], logoUrlFallbacks: urls.slice(1) };
}

const CRYPTOCURRENCY_ICONS_RAW =
  'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';

async function resolveIsinToInstrument(isin, kindHint) {
  const data = await fetchJson('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
  });
  const rows = data?.[0]?.data;
  if (!Array.isArray(rows) || !rows.length) return null;
  const de = rows.find((r) => ['GR', 'GF', 'GD', 'GS', 'GB', 'GT'].includes(r.exchCode));
  const us = rows.find((r) => r.exchCode === 'US' || r.micCode === 'XNAS' || r.micCode === 'XNYS');
  const row = de || us || rows[0];
  const sym = yahooTickerFromFigi(row);
  if (!sym) return null;
  const name = pickBestSecurityName(rows, sym) || formatSecurityName(row.name || row.ticker || sym);
  const kind = kindHint === 'crypto' ? 'crypto' : 'stock';
  if (kind === 'crypto') {
    const logoUrl = `${CRYPTOCURRENCY_ICONS_RAW}/${sym.split('.')[0].toLowerCase()}.png`;
    return { sym: sym.toUpperCase(), name, kind, isin, logoUrl, logoUrlFallbacks: [], resolved: true };
  }
  const usTicker = us ? yahooTickerFromFigi(us)?.split('.')[0] : undefined;
  const { logoUrl, logoUrlFallbacks } = stockLogoFields(sym, { usTicker });
  return { sym: sym.toUpperCase(), name, kind, isin, logoUrl, logoUrlFallbacks, resolved: true };
}

function sanitizeSymbol(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, '');
  if (!s || s.length > 16 || isIsinCode(s)) return null;
  return s;
}

async function resolveInstrumentInput(input, kindHint, nameHint) {
  const trimmed = String(input || '').trim();
  const isin = isIsinCode(trimmed) ? trimmed.toUpperCase().replace(/\s/g, '') : null;
  if (isin) {
    const fromIsin = await resolveIsinToInstrument(isin, kindHint);
    if (!fromIsin) throw new Error(`ISIN ${isin} nicht gefunden — Börsen-Kürzel manuell eingeben.`);
    return fromIsin;
  }
  const sym = sanitizeSymbol(trimmed);
  if (!sym) throw new Error('Bitte Börsen-Kürzel (z. B. AAPL, SAP.DE) oder gültige ISIN eingeben.');
  const kind = kindHint === 'crypto' ? 'crypto' : 'stock';
  const slug = sym.split('.')[0].toLowerCase();
  if (kind === 'crypto') {
    const logoUrl = `${CRYPTOCURRENCY_ICONS_RAW}/${slug}.png`;
    return { sym, name: String(nameHint || '').trim().slice(0, 56) || sym, kind, isin: undefined, logoUrl, logoUrlFallbacks: [], resolved: false };
  }
  const { logoUrl, logoUrlFallbacks } = stockLogoFields(sym);
  const nameHintTrim = String(nameHint || '').trim().slice(0, 56);
  let name = nameHintTrim || sym;
  if (!nameHintTrim || looksLikeTickerName(nameHintTrim, sym)) {
    const looked = await lookupSecurityName(sym);
    if (looked) name = looked.slice(0, 56);
  }
  return { sym, name, kind, isin: undefined, logoUrl, logoUrlFallbacks, resolved: false };
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

  app.post('/api/market/resolve', async (req, res) => {
    try {
      const input = String(req.body?.input || req.body?.sym || '').trim();
      if (!input) return res.status(400).json({ error: 'input erforderlich' });
      const kind = req.body?.kind === 'crypto' ? 'crypto' : 'stock';
      const nameHint = typeof req.body?.name === 'string' ? req.body.name : '';
      const resolved = await resolveInstrumentInput(input, kind, nameHint);
      return res.json(resolved);
    } catch (e) {
      console.error('[market] resolve:', e.message);
      return res.status(400).json({ error: e.message || 'Instrument konnte nicht aufgelöst werden.' });
    }
  });

  app.get('/api/fx/rate', async (req, res) => {
    try {
      const from = String(req.query.from || '').trim().toUpperCase();
      if (!from) return res.status(400).json({ error: 'from erforderlich' });
      if (from === 'EUR') {
        return res.json({ from: 'EUR', eurPerUnit: 1, date: new Date().toISOString().slice(0, 10) });
      }
      const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=EUR`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('frankfurter');
      const data = await r.json();
      const eurPerUnit = data?.rates?.EUR;
      if (typeof eurPerUnit !== 'number' || eurPerUnit <= 0) throw new Error('rate');
      return res.json({
        from,
        eurPerUnit,
        date: data.date || new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      console.error('[fx] rate:', e.message);
      return res.status(502).json({ error: 'Wechselkurs vorübergehend nicht verfügbar.' });
    }
  });
}
