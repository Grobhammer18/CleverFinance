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

function normalizePaymentMethod(raw) {
  const s = String(raw || '').trim();
  const hit = PAYMENT_METHODS.find((p) => p.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  if (/ec|giro|debit|karte|card|visa|master/i.test(s)) return 'Kreditkarte';
  if (/bar|cash/i.test(s)) return 'Bar';
  if (/paypal/i.test(s)) return 'PayPal';
  if (/lastschrift|sepa/i.test(s)) return 'Lastschrift';
  return '';
}

function parseGermanAmount(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw * 100) / 100;
  }
  const s = String(raw).replace(/\s/g, '').replace(/€|EUR/gi, '').replace(',', '.');
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
    return `${y}-${m}-${d}`;
  }
  return null;
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

  const systemPrompt = `Du analysierst Fotos von deutschen Kassenzetteln und Belegen.
Antworte NUR mit einem JSON-Objekt (kein Markdown drumherum), Schema:
{
  "amount": number,
  "date": "YYYY-MM-DD oder null",
  "merchant": "string",
  "category": "eine aus: ${EXPENSE_CATEGORIES.join(' | ')}",
  "paymentMethod": "eine aus: ${PAYMENT_METHODS.join(' | ')} oder leer",
  "confidence": "high" | "medium" | "low"
}
Regeln:
- amount = GESAMT / SUMME / zu zahlen (EUR), nicht Einzelposten addieren wenn Gesamtsumme sichtbar.
- merchant = Ladenname (kurz).
- Bei Unsicherheit: category "Sonstiges", confidence "low".
- Typische Ausgabe (kein Gehalt).`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrahiere die Buchungsdaten aus diesem Kassenzettel.' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
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

  const amount = parseGermanAmount(parsed.amount);
  if (!amount) {
    throw new Error('Gesamtbetrag auf dem Beleg nicht erkannt — bitte manuell eintragen.');
  }

  const date = parseReceiptDate(parsed.date) || new Date().toISOString().slice(0, 10);
  const merchant = String(parsed.merchant || parsed.store || parsed.shop || '')
    .trim()
    .slice(0, 120);
  const category = normalizeCategory(parsed.category);
  const paymentMethod = normalizePaymentMethod(parsed.paymentMethod);
  const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';

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
