import type { AppLocale } from './i18n/locale';
import { t } from './i18n/messages';

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

const BADGE_KEYS: { min: number; key: string; fontSize: number; fontWeight: number; color: string }[] = [
  { min: 1_000_000, key: 'badge1m', fontSize: 13, fontWeight: 700, color: '#c9d1d9' },
  { min: 500_000, key: 'badge500k', fontSize: 13, fontWeight: 700, color: '#c9d1d9' },
  { min: 200_000, key: 'badge200k', fontSize: 13, fontWeight: 700, color: '#c9d1d9' },
  { min: 100_000, key: 'badge100k', fontSize: 13, fontWeight: 700, color: '#c9d1d9' },
  { min: 50_000, key: 'badge50k', fontSize: 12, fontWeight: 700, color: '#8b949e' },
  { min: 20_000, key: 'badge20k', fontSize: 12, fontWeight: 700, color: '#8b949e' },
  { min: 10_000, key: 'badge10k', fontSize: 12, fontWeight: 700, color: '#8b949e' },
  { min: 8000, key: 'badge8k', fontSize: 12, fontWeight: 600, color: '#8b949e' },
];

/** Höchsten erreichten Meilenstein als eine Zeile unter dem Betrag — für Home / LevelUp. */
export function portfolioPowerBadgeFor(power: number, locale: AppLocale = 'de'): PortfolioPowerBadge | null {
  for (const row of BADGE_KEYS) {
    if (power >= row.min) {
      return {
        emoji: '',
        text: t(`overlay.${row.key}`, locale),
        fontSize: row.fontSize,
        fontWeight: row.fontWeight,
        color: row.color,
      };
    }
  }
  return null;
}

const MILESTONE_META: Record<
  PortfolioPowerMilestone,
  { headlineKey: string; subKey: string; icon: string; accent: string; confetti: number }
> = {
  8000: { headlineKey: 'milestone8000Headline', subKey: 'milestone8000Sub', icon: '🏆', accent: '#a855f7', confetti: 14 },
  10_000: { headlineKey: 'milestone10kHeadline', subKey: 'milestone10kSub', icon: '✨', accent: '#f8d03a', confetti: 16 },
  20_000: { headlineKey: 'milestone20kHeadline', subKey: 'milestone20kSub', icon: '📈', accent: '#00d4aa', confetti: 16 },
  50_000: { headlineKey: 'milestone50kHeadline', subKey: 'milestone50kSub', icon: '🔷', accent: '#a855f7', confetti: 18 },
  100_000: { headlineKey: 'milestone100kHeadline', subKey: 'milestone100kSub', icon: '⚡', accent: '#58a6ff', confetti: 20 },
  200_000: { headlineKey: 'milestone200kHeadline', subKey: 'milestone200kSub', icon: '💠', accent: '#7dd3fc', confetti: 20 },
  500_000: { headlineKey: 'milestone500kHeadline', subKey: 'milestone500kSub', icon: '🚀', accent: '#58a6ff', confetti: 22 },
  1_000_000: { headlineKey: 'milestone1mHeadline', subKey: 'milestone1mSub', icon: '🌟', accent: '#f8d03a', confetti: 26 },
};

export function milestoneCelebrationMeta(
  m: PortfolioPowerMilestone,
  locale: AppLocale = 'de',
): {
  headline: string;
  sub: string;
  btn: string;
  icon: string;
  accent: string;
  confetti: number;
} {
  const meta = MILESTONE_META[m];
  return {
    headline: t(`overlay.${meta.headlineKey}`, locale),
    sub: t(`overlay.${meta.subKey}`, locale),
    btn: t('overlay.milestoneContinue', locale),
    icon: meta.icon,
    accent: meta.accent,
    confetti: meta.confetti,
  };
}
