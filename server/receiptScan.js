/**
 * Kassenzettel → strukturierte Buchungs-Vorschläge (OpenAI Vision).
 * Env: OPENAI_API_KEY, optional RECEIPT_SCAN_MODEL (default gpt-4o-mini)
 */

const EXPENSE_CATEGORIES = [
  'Essen & Trinken',
  'Fahrtkosten',
  'Abos',
  'Kreditrate',
  'Notgroschen',
  'Miete',
  'Kleidung',
  'Gesundheit',
  'Freizeit',
  'Geschenk',
  'Sonstiges',
];

const PAYMENT_METHODS = [
  'Bar',
  'Kreditkarte',
  'Überweisung',
  'Lastschrift',
  'PayPal',
  'Cash Depot',
  'Einzahlung Cash Depot',
  'Notgroschen',
  'Sonstiges',
];

function normalizeCategory(raw) {
  const s = String(raw || '').trim();
  const hit = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  if (/essen|trinken|supermarkt|restaurant|bäcker|baecker|rewe|edeka|aldi|lidl|penny|netto/i.test(s)) {
    return 'Essen & Trinken';
  }
  if (/tank|aral|shell|bahn|db |uber|taxi|park/i.test(s)) return 'Fahrtkosten';
  if (/apotheke|arzt|dm |rossmann|gesundheit/i.test(s)) return 'Gesundheit';
  if (/miete|wohnung/i.test(s)) return 'Miete';
  if (/kleidung|h&m|zara|mode/i.test(s)) return 'Kleidung';
  return 'Sonstiges';
}

function normalizePaymentMethod(raw, merchant = '', visibleText = '') {
  const blob = `${raw} ${merchant} ${visibleText}`.toLowerCase();
  const s = String(raw || '').trim();
  const hit = PAYMENT_METHODS.find((p) => p.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  if (/lidl\s*pay|apple\s*pay|google\s*pay|kart|karte|ec-|girocard|giro|debit|visa|master|contactless|kontaktlos|pay\b/i.test(blob)) {
    return 'Kreditkarte';
  }
  if (/paypal/i.test(blob)) return 'PayPal';
  if (/lastschrift|sepa/i.test(blob)) return 'Lastschrift';
  if (/bar|cash\b/i.test(blob)) return 'Bar';
  return '';
}

function parseGermanAmount(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw * 100) / 100;
  }
  let s = String(raw).replace(/\s/g, '').replace(/€|EUR/gi, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const m = s.match(/(\d+\.?\d*)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function parseReceiptDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (de) {
    let y = parseInt(de[3], 10);
    if (y < 100) y += 2000;
    const m = String(parseInt(de[2], 10)).padStart(2, '0');
    const d = String(parseInt(de[1], 10)).padStart(2, '0');
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) return `${y}-${m}-${d}`;
  }
  return null;
}

/** Betrag aus typischen deutschen Kassenzettel-Zeilen (zu zahlen, Lidl Pay, …). */
function extractAmountFromReceiptText(text) {
  const t = String(text || '').replace(/\r/g, '\n');
  if (!t.trim()) return null;

  const linePatterns = [
    /zu\s*zahlen[^\d\n]*(\d{1,5}[,.]\d{2})/i,
    /lidl\s*pay[^\d\n]*(\d{1,5}[,.]\d{2})/i,
    /(?:^|\n)\s*SUMME\s*(?:EUR)?[^\d\n]*(\d{1,5}[,.]\d{2})/im,
    /gesamtbetrag[^\d\n]*(\d{1,5}[,.]\d{2})/i,
    /rechnungsbetrag[^\d\n]*(\d{1,5}[,.]\d{2})/i,
    /(?:^|\n)\s*TOTAL[^\d\n]*(\d{1,5}[,.]\d{2})/im,
  ];
  for (const p of linePatterns) {
    const m = t.match(p);
    if (m) {
      const amt = parseGermanAmount(m[1]);
      if (amt && amt >= 0.01) return amt;
    }
  }

  /** MWST-Zeilen ignorieren — nur „Summe“ am Ende mit Brutto-Spalte. */
  const mwstSumme = t.match(/Summe\s+[\d,.]+\s+[\d,.]+\s+(\d{1,5}[,.]\d{2})/i);
  if (mwstSumme) {
    const amt = parseGermanAmount(mwstSumme[1]);
    if (amt && amt >= 1) return amt;
  }

  return null;
}

function extractDateFromReceiptText(text) {
  const t = String(text || '');
  const tse = t.match(/(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/);
  if (tse) return tse[1];

  const withTime = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+\d{1,2}:\d{2}\b/);
  if (withTime) {
    const parsed = parseReceiptDate(`${withTime[1]}.${withTime[2]}.${withTime[3]}`);
    if (parsed) return parsed;
  }

  const dates = [...t.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g)];
  for (const m of dates) {
    const parsed = parseReceiptDate(`${m[1]}.${m[2]}.${m[3]}`);
    if (parsed) return parsed;
  }
  return null;
}

function pickBestAmount(modelAmount, textAmount) {
  const model = parseGermanAmount(modelAmount);
  const fromText = textAmount != null ? parseGermanAmount(textAmount) : null;
  if (!fromText) return model;
  if (!model) return fromText;
  const ratio = fromText / model;
  if (ratio > 1.15 || ratio < 0.85) return fromText;
  return model;
}

function pickBestDate(modelDate, textDate) {
  const fromModel = parseReceiptDate(modelDate);
  const fromText = textDate ? parseReceiptDate(textDate) : null;
  if (fromText && fromModel && fromText !== fromModel) return fromText;
  return fromText || fromModel;
}

/** OpenAI-Fehler → kurze deutsche Meldung fürs Handy. */
export function friendlyOpenAiError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('quota') || m.includes('billing') || m.includes('insufficient') || m.includes('credit')) {
    return 'OpenAI: Guthaben oder Zahlungsmethode fehlt — unter platform.openai.com → Settings → Billing Karte hinterlegen.';
  }
  if (m.includes('incorrect api key') || m.includes('invalid api key') || m.includes('api key')) {
    return 'OpenAI API-Key ungültig — OPENAI_API_KEY auf Railway prüfen (neuen Key von platform.openai.com/api-keys).';
  }
  if (m.includes('model') && (m.includes('not found') || m.includes('does not exist') || m.includes('access'))) {
    return 'KI-Modell nicht verfügbar — auf Railway RECEIPT_SCAN_MODEL=gpt-4o-mini setzen oder Billing bei OpenAI aktivieren.';
  }
  if (m.includes('rate limit')) {
    return 'Zu viele Anfragen — bitte in einer Minute erneut versuchen.';
  }
  const short = String(message || 'Scan fehlgeschlagen.').slice(0, 220);
  return short.length < String(message || '').length ? `${short}…` : short;
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Keine JSON-Antwort vom Modell.');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function scanReceiptImage({ imageBase64, mimeType = 'image/jpeg' }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY fehlt auf dem Server (Railway Variables).');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const model = String(process.env.RECEIPT_SCAN_MODEL || 'gpt-4o-mini').trim();
  const b64 = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '').trim();
  if (!b64 || b64.length < 100) {
    throw new Error('Kein gültiges Bild.');
  }
  if (b64.length > 6_500_000) {
    throw new Error('Bild zu groß — bitte näher ranzoomen oder erneut fotografieren.');
  }

  const safeMime = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mimeType) ? mimeType : 'image/jpeg';
  const dataUrl = `data:${safeMime};base64,${b64}`;

  const systemPrompt = `Du analysierst Fotos von deutschen Kassenzetteln, Quittungen und Rechnungen (auch lange Supermarkt-Bons wie Lidl, Aldi, Rewe).
Antworte NUR mit JSON (kein Markdown):
{
  "amount": number,
  "date": "YYYY-MM-DD oder null",
  "merchant": "string",
  "category": "eine aus: ${EXPENSE_CATEGORIES.join(' | ')}",
  "paymentMethod": "eine aus: ${PAYMENT_METHODS.join(' | ')} oder leer",
  "confidence": "high" | "medium" | "low",
  "visibleText": "wichtigste Zeilen des Belegs als Klartext, besonders unten: zu zahlen, Lidl Pay, Datum, Uhrzeit, TSE"
}

KRITISCH — Betrag (amount):
- NUR der Endbetrag den der Kunde gezahlt hat: Zeile „zu zahlen“, „Lidl Pay“, „Gesamtbetrag“, „SUMME EUR“ (Zahlung).
- NICHT: Einzelposten, Stückpreise, MWST/MwSt.-Steuerbeträge (z. B. 4,15 oder 4,28), Netto-Summen, Pfand, Rabatt-Zeilen.
- Bei Lidl: unter „zu zahlen“ und bei „Lidl Pay“ steht derselbe Gesamtbetrag (z. B. 64,16).

Datum:
- Kassendatum auf dem Bon (oft DD.MM.YY mit Uhrzeit, YY=26 → 2026). TSE-Zeile (2026-06-01T…) hat Vorrang.
- Kein erfundenes Datum — nur was auf dem Beleg steht.

Zahlungsart:
- „Lidl Pay“, EC, Girocard, Karte → paymentMethod „Kreditkarte“, nicht „Bar“.

merchant = Markenname (z. B. Lidl). Ausgabe, kein Gehalt.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Lies den ganzen Beleg von oben bis unten. Gib amount = „zu zahlen“ / Zahlungsbetrag und visibleText mit den relevanten Zeilen.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message || `OpenAI Fehler (${res.status})`;
    const err = new Error(friendlyOpenAiError(raw));
    err.code = 'OPENAI_ERROR';
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJsonObject(content);
  const visibleText = String(parsed.visibleText || parsed.ocrText || parsed.text || '').trim();

  const textAmount = extractAmountFromReceiptText(visibleText);
  const amount = pickBestAmount(parsed.amount, textAmount);
  if (!amount) {
    throw new Error('Gesamtbetrag auf dem Beleg nicht erkannt — bitte manuell eintragen.');
  }

  const textDate = extractDateFromReceiptText(visibleText);
  const date = pickBestDate(parsed.date, textDate) || new Date().toISOString().slice(0, 10);

  const merchant = String(parsed.merchant || parsed.store || parsed.shop || '')
    .trim()
    .slice(0, 120);
  const category = normalizeCategory(parsed.category || merchant);
  const paymentMethod = normalizePaymentMethod(parsed.paymentMethod, merchant, visibleText);

  let confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';
  if (textAmount && Math.abs(textAmount - (parseGermanAmount(parsed.amount) || 0)) > 0.02) {
    confidence = confidence === 'high' ? 'medium' : confidence;
  }
  if (!textAmount && amount > 50 && visibleText.length < 40) {
    confidence = 'low';
  }

  return {
    type: 'ausgabe',
    amount,
    date,
    note: merchant,
    category,
    paymentMethod,
    confidence,
  };
}
