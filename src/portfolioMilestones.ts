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
    return { emoji: '🌟', text: '1 Million € — LEGENDE!', fontSize: 14, fontWeight: 900, color: '#f8d03a' };
  }
  if (power >= 500_000) {
    return { emoji: '🚀', text: '500.000 € — Halbe-Million-Club!', fontSize: 13, fontWeight: 800, color: '#58a6ff' };
  }
  if (power >= 200_000) {
    return { emoji: '💠', text: '200.000 € geknackt!', fontSize: 13, fontWeight: 800, color: '#a5d6ff' };
  }
  if (power >= 100_000) {
    return { emoji: '⚡', text: '100.000 € — sechsstellig!', fontSize: 13, fontWeight: 800, color: '#c4b5fd' };
  }
  if (power >= 50_000) {
    return { emoji: '🔷', text: '50.000 € Marke!', fontSize: 12, fontWeight: 800, color: '#a855f7' };
  }
  if (power >= 20_000) {
    return { emoji: '✨', text: '20.000 € geknackt!', fontSize: 12, fontWeight: 800, color: '#c4b5fd' };
  }
  if (power >= 10_000) {
    return { emoji: '🥇', text: '10.000 € GEKNACKT! LEVEL UP!', fontSize: 13, fontWeight: 800, color: '#f8d03a' };
  }
  if (power >= 8000) {
    return { emoji: '🏆', text: '8.000 € Marke geknackt!', fontSize: 12, fontWeight: 700, color: '#a855f7' };
  }
  return null;
}

export type PortfolioMilestoneCelebrationTier = 'violet' | 'gold' | 'cyan' | 'purple' | 'electric' | 'blue' | 'nova' | 'mega';

export function milestoneCelebrationMeta(m: PortfolioPowerMilestone): {
  headline: string;
  sub: string;
  btn: string;
  confetti: number;
  tier: PortfolioMilestoneCelebrationTier;
  heroEmoji: string;
} {
  switch (m) {
    case 8000:
      return {
        headline: '8.000 € Marke geknackt!',
        sub: 'Portfolio Power + Cash Depot — starke erste Hausnummer. Nächste Stufen warten!',
        btn: 'Weiter aufbauen! 💪',
        confetti: 56,
        tier: 'violet',
        heroEmoji: '🏆',
      };
    case 10_000:
      return {
        headline: '10.000 € geknackt!',
        sub: 'Du bist auf Kurs — das erste richtige Level-Up im Portfolio!',
        btn: 'Weiter — Level up! 🚀',
        confetti: 72,
        tier: 'gold',
        heroEmoji: '🥇',
      };
    case 20_000:
      return {
        headline: '20.000 € erreicht!',
        sub: 'Kontinuierlicher Aufbau zahlt sich aus — weiter so!',
        btn: 'Nice! Weiter ➜',
        confetti: 82,
        tier: 'cyan',
        heroEmoji: '✨',
      };
    case 50_000:
      return {
        headline: '50.000 € — wow!',
        sub: 'Ein ernstes Polster wächst — Respekt für die Disziplin.',
        btn: 'Weiter rocken! 🔷',
        confetti: 92,
        tier: 'purple',
        heroEmoji: '🔷',
      };
    case 100_000:
      return {
        headline: '100.000 € — sechsstellig!',
        sub: 'Du bist im sechsstelligen Bereich angekommen. Das ist selten stark.',
        btn: 'Weiter — Power! ⚡',
        confetti: 104,
        tier: 'electric',
        heroEmoji: '⚡',
      };
    case 200_000:
      return {
        headline: '200.000 € geknackt!',
        sub: 'Portfolio und Cash spielen in einer ganz anderen Liga.',
        btn: 'Weiter! 💠',
        confetti: 116,
        tier: 'blue',
        heroEmoji: '💠',
      };
    case 500_000:
      return {
        headline: '500.000 € — halbe Million!',
        sub: 'Klub auf Weltniveau. Noch einen Schritt bis zur absoluten Eskalation.',
        btn: '🚀 Halbe Million gefeiert!',
        confetti: 132,
        tier: 'nova',
        heroEmoji: '🚀',
      };
    case 1_000_000:
      return {
        headline: '1 MILLION € — KOMPLETT ESKALIERT!',
        sub:
          'Champagner-Modus: Du hast die Million im Portfolio‑Power‑Sinne geknackt. Das ist keine Übung — pure Legende.',
        btn: 'LEGEND STATUS 🌟 🍾',
        confetti: 185,
        tier: 'mega',
        heroEmoji: '🌟',
      };
    default: {
      const _x: never = m;
      return _x;
    }
  }
}
