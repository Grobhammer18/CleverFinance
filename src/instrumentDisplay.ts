/** 12-stellige Wertpapier-ISIN (z. B. DE0005140008). */
export function isIsinCode(raw: string): boolean {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s);
}

export function normalizeIsin(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
}

/** Primär Anzeigename, sekundär Kürzel/ISIN — nie ISIN als große Überschrift wenn Name bekannt. */
export function instrumentDisplayLines(item: {
  sym: string;
  name?: string;
  isin?: string;
}): { title: string; subtitle: string } {
  const sym = String(item.sym || '').trim();
  const name = String(item.name || '').trim();
  const isin = item.isin && isIsinCode(item.isin) ? normalizeIsin(item.isin) : '';
  const symIsIsin = isIsinCode(sym);
  const nameIsUsable = name.length > 0 && !isIsinCode(name) && name.toUpperCase() !== sym.toUpperCase();

  const subtitleParts: string[] = [];
  if (!symIsIsin && sym) subtitleParts.push(sym);
  if (isin) subtitleParts.push(`ISIN ${isin}`);
  else if (symIsIsin) subtitleParts.push(`ISIN ${sym}`);

  if (nameIsUsable) {
    return { title: name, subtitle: subtitleParts.join(' · ') };
  }
  if (symIsIsin) {
    return { title: 'Wertpapier', subtitle: `ISIN ${sym}` };
  }
  return {
    title: sym,
    subtitle: name && name.toUpperCase() !== sym.toUpperCase() ? name : subtitleParts.filter((p) => p !== sym).join(' · '),
  };
}
