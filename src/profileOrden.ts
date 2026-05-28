/**
 * Feste Orden-Liste (Creator) — unter „Mehr“.
 * Freischaltung nur über erreichte Bedingungen in der App, nicht durch manuelle Einträge.
 */

/** Persistenz: neue IDs (auch für Gäste ohne Account). */
export const ORDEN_EARNED_STORAGE_KEY = 'allwin.ordenEarnedPresetIds';

/** Altes Format nur zur Migration aus LocalStorage / Profil. */
export const LEGACY_MANUAL_ORDEN_STORAGE_KEY = 'allwin.manualOrden';

export type OrdenCatalogEntry = {
  presetId: string;
  emoji: string;
  title: string;
};

/** Katalog-Reihenfolge = Darstellung unter „Mehr“. */
export const ORDEN_CATALOG: readonly OrdenCatalogEntry[] = [
  { presetId: 'boost-schulden-frei', emoji: '🎖️', title: 'Clever Finance Schulden-frei Orden' },
  { presetId: 'notgroschen-voll', emoji: '🛡️', title: 'Notgroschen-Ziel erreicht' },
  { presetId: 'portfolio-8000', emoji: '🏆', title: '8.000 € Portfolio Power' },
  { presetId: 'portfolio-10000', emoji: '🥇', title: '10.000 € Portfolio Power' },
  { presetId: 'portfolio-20000', emoji: '✨', title: '20.000 € Portfolio Power' },
  { presetId: 'portfolio-50000', emoji: '🔷', title: '50.000 € Portfolio Power' },
  { presetId: 'portfolio-100000', emoji: '⚡', title: '100.000 € Portfolio Power' },
  { presetId: 'portfolio-200000', emoji: '💠', title: '200.000 € Portfolio Power' },
  { presetId: 'portfolio-500000', emoji: '🚀', title: '500.000 € Portfolio Power' },
  { presetId: 'portfolio-1000000', emoji: '🌟', title: '1 Million € Portfolio Power — Legende!' },
];

const CATALOG_ID_SET = new Set(ORDEN_CATALOG.map((o) => o.presetId));

export function portfolioEurToOrdenPresetId(eur: number): string {
  return `portfolio-${eur}`;
}

function extractPresetIdsFromLegacyManual(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const p = (row as { presetId?: unknown }).presetId;
    if (typeof p === 'string' && CATALOG_ID_SET.has(p)) ids.push(p);
  }
  return ids;
}

/**
 * Kombiniert gespeicherte Freischaltungen mit Altbestand aus `manualOrden[].presetId` (Migration).
 */
export function normalizeEarnedOrdenOnLoad(ordenEarnedPresetIds: unknown, legacyManualOrden?: unknown): string[] {
  const acc = new Set<string>();
  if (Array.isArray(ordenEarnedPresetIds)) {
    for (const x of ordenEarnedPresetIds) {
      if (typeof x === 'string' && CATALOG_ID_SET.has(x)) acc.add(x);
    }
  }
  for (const id of extractPresetIdsFromLegacyManual(legacyManualOrden)) acc.add(id);
  return [...acc].sort();
}

export function readGuestEarnedOrdenPresetIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const token = localStorage.getItem('allwin.token');
    if (token && token.trim()) return [];
    const rawNew = localStorage.getItem(ORDEN_EARNED_STORAGE_KEY);
    if (rawNew) {
      return normalizeEarnedOrdenOnLoad(JSON.parse(rawNew), undefined);
    }
    const rawOld = localStorage.getItem(LEGACY_MANUAL_ORDEN_STORAGE_KEY);
    return normalizeEarnedOrdenOnLoad([], JSON.parse(rawOld || 'null'));
  } catch {
    return [];
  }
}

export function sanitizeEarnedOrdenIds(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter((id) => CATALOG_ID_SET.has(id)))].sort();
}
