import type { FinanceWho } from '../onboarding/onboardingLogic';
import type { AppLocale } from './locale';
import { localeToIntlTag } from './locale';
import { formatMoneyAmount } from '../currencyFx';

export type OnboardingCopy = {
  header: string;
  headerTime: string;
  common: {
    continue: string;
    yes: string;
    no: string;
    other: string;
  };
  financeWho: {
    title: string;
    mood: string;
    alone: string;
    partner: string;
    delegate: string;
    btn: string;
  };
  baseCurrency: {
    title: string;
    mood: string;
    btn: string;
  };
  netIncome: {
    titleAlone: string;
    titlePartner: string;
    mood: string;
    hint: (sym: string) => string;
    placeholder: string;
    btn: string;
  };
  debtsYn: {
    titleAlone: string;
    titlePartner: string;
    mood: string;
    btn: string;
  };
  intro: {
    hey: (subj: string) => string;
    subline: string;
    body: (subj: string) => string;
    btn: string;
  };
  finish: {
    titleAlone: string;
    titlePartner: string;
    body: string;
    btn: string;
  };
  topics: string[];
  whyHere: string[];
  fmtMoney: (n: number, currency: string, locale?: AppLocale) => string;
};

const DE: OnboardingCopy = {
  header: 'Clever Finance · Onboarding 😊',
  headerTime: 'ca. 5 Min · easy ✨',
  common: { continue: 'Weiter', yes: 'Ja', no: 'Nein', other: 'Sonstiges' },
  financeWho: {
    title: 'Wie verwaltet {subj} die Finanzen? 👋',
    mood: 'Kleine Auswahl — wir sprechen dich danach einfach richtig an 🙂',
    alone: 'Alleine',
    partner: 'Mit Partner:in',
    delegate: 'Partner:in gibt das Geld — ich verwalte es',
    btn: 'Passt — weiter geht\'s ✨',
  },
  baseCurrency: {
    title: 'Welche Grundwährung hast du momentan? 💱',
    mood: 'Alle Summen und neue Buchungen nutzen diese Währung — du kannst sie später unter Money ändern.',
    btn: 'Passt — weiter ✨',
  },
  netIncome: {
    titleAlone: 'Wie viel verdienst du netto (monatlich)? 💶',
    titlePartner: 'Wie viel Netto verdient ihr zusammen? 💶',
    mood: 'Nur für dein Setup — Daten bleiben bei dir 🔒',
    hint: (sym) => `Angabe in ${sym} netto pro Monat.`,
    placeholder: 'z. B. 3200 oder 3200,50',
    btn: 'Super — weiter 😊',
  },
  debtsYn: {
    titleAlone: 'Hast du Schulden? 🤝',
    titlePartner: 'Habt ihr Schulden? 🤝',
    mood: 'Ehrlich ist cool — zero Drama, nur bessere Tipps.',
    btn: 'Weiter',
  },
  intro: {
    hey: (subj) => `Hey! Schön, dass ${subj === 'ihr' ? 'ihr' : 'du'} hier ${subj === 'ihr' ? 'seid' : 'bist'}! 🎉`,
    subline: 'Deine Finanz-Freiheit — spielerisch, klar, ohne Druck.',
    body: (subj) =>
      `Wir stellen ein paar Fragen, damit Clever Finance zu ${subj === 'ihr' ? 'euch' : 'dir'} passt — danach zeigen wir dir kurz, wo du was in der App findest.`,
    btn: 'Los geht\'s — ich bin bereit 💪',
  },
  finish: {
    titleAlone: '🎉 Du bist startklar!',
    titlePartner: '🎉 Ihr seid startklar!',
    body: 'Deine Antworten sind gespeichert. Gleich führt dich eine kurze Tour mit Licht & Sprechblase durch die App. ✨',
    btn: 'Clever Finance starten 🚀',
  },
  topics: ['Aktien', "ETF's / Fonds", 'Immobilien', 'P2P', 'Lebensversicherung', 'Sonstiges'],
  whyHere: [
    'Einfache Übersicht zu haben',
    'Die Tools nutzen',
    'Alles auf einem Blick haben',
    'Mit den Finanzen mehr beschäftigen',
    'Sonstiges',
  ],
  fmtMoney: (n, currency, loc = 'de') => formatMoneyAmount(n, currency, localeToIntlTag(loc)),
};

const EN: OnboardingCopy = {
  header: 'Clever Finance · Onboarding 😊',
  headerTime: '~5 min · easy ✨',
  common: { continue: 'Continue', yes: 'Yes', no: 'No', other: 'Other' },
  financeWho: {
    title: 'How do {subj} manage finances? 👋',
    mood: 'Quick pick — we\'ll address you correctly afterwards 🙂',
    alone: 'On my own',
    partner: 'With my partner',
    delegate: 'Partner earns — I manage the money',
    btn: 'Looks good — continue ✨',
  },
  baseCurrency: {
    title: 'What is your base currency right now? 💱',
    mood: 'All totals and new entries use this currency — you can change it later under Money.',
    btn: 'Got it — continue ✨',
  },
  netIncome: {
    titleAlone: 'What is your net monthly income? 💶',
    titlePartner: 'What is your combined net monthly income? 💶',
    mood: 'Only for your setup — your data stays with you 🔒',
    hint: (sym) => `Amount in ${sym} net per month.`,
    placeholder: 'e.g. 3200 or 3200.50',
    btn: 'Great — continue 😊',
  },
  debtsYn: {
    titleAlone: 'Do you have debts? 🤝',
    titlePartner: 'Do you have debts? 🤝',
    mood: 'Honesty helps — no drama, just better tips.',
    btn: 'Continue',
  },
  intro: {
    hey: () => 'Hey! Great to have you here! 🎉',
    subline: 'Your financial freedom — playful, clear, no pressure.',
    body: () =>
      'We\'ll ask a few questions so Clever Finance fits you — then we\'ll briefly show you around the app.',
    btn: 'Let\'s go — I\'m ready 💪',
  },
  finish: {
    titleAlone: '🎉 You\'re all set!',
    titlePartner: '🎉 You\'re all set!',
    body: 'Your answers are saved. Next, a short guided tour with highlights through the app. ✨',
    btn: 'Start Clever Finance 🚀',
  },
  topics: ['Stocks', 'ETFs / funds', 'Real estate', 'P2P', 'Life insurance', 'Other'],
  whyHere: [
    'Keep a simple overview',
    'Use the tools',
    'See everything at a glance',
    'Engage more with my finances',
    'Other',
  ],
  fmtMoney: (n, currency, loc = 'en') => formatMoneyAmount(n, currency, localeToIntlTag(loc)),
};

export function getOnboardingCopy(locale: AppLocale): OnboardingCopy {
  return locale === 'en' ? EN : DE;
}

export function financeWhoSubj(who: FinanceWho, locale: AppLocale): string {
  if (locale === 'en') return who === 'partner' ? 'you both' : 'you';
  if (who === 'partner') return 'ihr';
  return 'du';
}
