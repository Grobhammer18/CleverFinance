/**
 * Oberflächen wie Logo-Hintergrund: kühles Charcoal, Spotlight oben, Rand fast schwarz.
 */
export const allwinPalette = {
  app: 'radial-gradient(ellipse 125% 92% at 50% -12%, #2e2e36 0%, #18181c 34%, #0e0e12 62%, #050506 100%)',
  appFallback: '#050506',
  header: 'linear-gradient(180deg, rgba(46, 46, 54, 0.42) 0%, rgba(8, 8, 10, 0.94) 100%)',
  card: '#151518',
  cardBorder: '#2c2c36',
  hole: '#0a0a0e',
  field: '#0c0c10',
  dock: 'rgba(12, 12, 16, 0.86)',
  chipOff: '#1c1c22',
  line: '#34343e',
  mutedBtn: '#383844',
} as const;

/**
 * Clever Finance — Akzentfarbe (dunkles Königsblau, ersetzt Türkis #00d4aa / Mint #00f5c9).
 * Überall nutzen: positive Zahlen, primäre Chips, Flächen, Erfolgstexte.
 */
export const cfAccent = {
  blue: '#2563eb',
  blueLight: '#93c5fd',
  blueDeep: '#1d4ed8',
  /** rgba()-String für Glows aus Blue #2563eb */
  glow18: 'rgba(37, 99, 235, 0.18)',
  glow22: 'rgba(37, 99, 235, 0.22)',
  glow35: 'rgba(37, 99, 235, 0.35)',
} as const;
