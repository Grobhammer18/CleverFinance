/** Portfolio Power + Cash Depot — gefeierte Meilensteine (aufsteigend). */
export const PORTFOLIO_POWER_MILESTONE_EURS = [
  8000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000,
] as const;

export type PortfolioPowerMilestone = (typeof PORTFOLIO_POWER_MILESTONE_EURS)[number];

/** Höchster überschrittener Schwellenwert zwischen zwei Power-Werten (eine Popup-Runde). */
export function highestPortfolioMilestoneCrossed(prev: number, next: number): PortfolioPowerMilestone | null {
  let hit: PortfolioPowerMilestone | null = null;
  for (const m of PORTFOLIO_POWER_MILESTONE_EURS) {
    if (prev < m && next >= m) hit = m;
  }
  return hit;
}

export type PortfolioPowerBadge = {
  emoji: string;
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
};

/** Höchsten erreichten Meilenstein als eine Zeile unter dem Betrag — für Home / LevelUp. */
export function portfolioPowerBadgeFor(power: number): PortfolioPowerBadge | null {
  if (power >= 1_000_000) {
    return { emoji: '', text: '1 Mio. € Vermögen', fontSize: 13, fontWeight: 700, color: '#c9d1d9' };
  }
  if (power >= 500_000) {
    return { emoji: '', text: '500.000 € Vermögen', fontSize: 13, fontWeight: 700, color: '#c9d1d9' };
  }
  if (power >= 200_000) {
    return { emoji: '', text: '200.000 € Vermögen', fontSize: 13, fontWeight: 700, color: '#c9d1d9' };
  }
  if (power >= 100_000) {
    return { emoji: '', text: '100.000 € Vermögen', fontSize: 13, fontWeight: 700, color: '#c9d1d9' };
  }
  if (power >= 50_000) {
    return { emoji: '', text: '50.000 € Vermögen', fontSize: 12, fontWeight: 700, color: '#8b949e' };
  }
  if (power >= 20_000) {
    return { emoji: '', text: '20.000 € Vermögen', fontSize: 12, fontWeight: 700, color: '#8b949e' };
  }
  if (power >= 10_000) {
    return { emoji: '', text: '10.000 € Vermögen', fontSize: 12, fontWeight: 700, color: '#8b949e' };
  }
  if (power >= 8000) {
    return { emoji: '', text: '8.000 € Vermögen', fontSize: 12, fontWeight: 600, color: '#8b949e' };
  }
  return null;
}

export function milestoneCelebrationMeta(m: PortfolioPowerMilestone): {
  headline: string;
  sub: string;
  btn: string;
} {
  switch (m) {
    case 8000:
      return {
        headline: '8.000 € Vermögen',
        sub: 'Portfolio Power und Cash Depot zusammen über 8.000 € — solide Basis für den nächsten Schritt.',
        btn: 'Weiter',
      };
    case 10_000:
      return {
        headline: '10.000 € Vermögen',
        sub: 'Die fünfstellige Marke ist erreicht. Kontinuität zahlt sich aus.',
        btn: 'Weiter',
      };
    case 20_000:
      return {
        headline: '20.000 € Vermögen',
        sub: 'Dein Vermögen wächst planbar — weiter am Plan festhalten.',
        btn: 'Weiter',
      };
    case 50_000:
      return {
        headline: '50.000 € Vermögen',
        sub: 'Ein beachtliches Polster. Disziplin und Zeit wirken hier sichtbar.',
        btn: 'Weiter',
      };
    case 100_000:
      return {
        headline: '100.000 € Vermögen',
        sub: 'Sechsstellig — ein Meilenstein, den viele erst nach Jahren erreichen.',
        btn: 'Weiter',
      };
    case 200_000:
      return {
        headline: '200.000 € Vermögen',
        sub: 'Portfolio und Cash Depot zusammen über 200.000 €.',
        btn: 'Weiter',
      };
    case 500_000:
      return {
        headline: '500.000 € Vermögen',
        sub: 'Halbe Million im Gesamtvermögen — stark aufgestellt.',
        btn: 'Weiter',
      };
    case 1_000_000:
      return {
        headline: '1 Mio. € Vermögen',
        sub: 'Eine Million Portfolio Power plus Cash Depot — ein seltener und bedeutsamer Stand.',
        btn: 'Weiter',
      };
    default: {
      const _x: never = m;
      return _x;
    }
  }
}
