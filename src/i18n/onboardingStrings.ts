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
  debtsTypes: {
    title: string;
    mood: string;
    consumer: string;
    house: string;
  };
  debtsCount: {
    title: string;
    mood: string;
    placeholder: string;
  };
  debtsEntries: {
    title: string;
    hint: string;
    loanN: (n: number) => string;
    consumer: string;
    house: string;
    namePlaceholder: string;
    totalPlaceholder: (sym: string) => string;
    monthlyPlaceholder: (sym: string) => string;
  };
  emergencyYn: {
    titleAlone: string;
    titlePartner: string;
    mood: string;
    targetHint: (target: string) => string;
  };
  emergencyBalance: {
    title: string;
    mood: string;
    placeholder: (sym: string) => string;
  };
  emergencyMonthly: {
    titleAlone: string;
    titlePartner: string;
    mood: string;
    placeholder: (sym: string) => string;
  };
  splashFocus: {
    debtTitle: string;
    emergencyTitle: string;
    mood: string;
    debtBody: string;
    emergencyBody: (target: string) => string;
    btn: string;
  };
  investExperienced: {
    title: string;
    mood: string;
  };
  investTopics: {
    title: string;
    mood: string;
    otherPlaceholder: string;
  };
  investAmount: {
    title: string;
    hint: string;
    placeholder: (sym: string) => string;
  };
  investMonthly: {
    title: string;
    mood: string;
    placeholder: (sym: string) => string;
  };
  investRisk: {
    title: string;
    mood: string;
    low: string;
    mid: string;
    high: string;
  };
  investClassesIntent: {
    title: string;
    mood: string;
  };
  investClassesHeld: {
    title: string;
    mood: string;
    otherPlaceholder: string;
  };
  investDetails: {
    title: string;
    mood: string;
    hint: string;
    stockLabel: string;
    cryptoLabel: string;
    propertyLabel: string;
    p2pLabel: string;
    nameStockPlaceholder: string;
    buyPricePlaceholder: (sym: string) => string;
    qtyPlaceholder: string;
    qtyCryptoPlaceholder: string;
    watchlistAuto: string;
    watchlistCryptoAuto: string;
    watchlistPropertyAuto: string;
    watchlistPropertyOn: (sym: string) => string;
    watchlistP2pAuto: string;
    watchlistP2pOn: (sym: string) => string;
    addPosition: string;
    addCrypto: string;
    addProperty: string;
    propertyLocationPlaceholder: string;
    propertyStreetPlaceholder: string;
    propertyAreaPlaceholder: string;
    propertyRentPlaceholder: (sym: string) => string;
    propertyUtilitiesPlaceholder: (sym: string) => string;
    propertyRaiseDatePlaceholder: string;
    propertyRaiseCyclePlaceholder: string;
    cryptoNamePlaceholder: string;
    p2pTotalPlaceholder: (sym: string) => string;
    p2pProfitPlaceholder: string;
  };
  whyHereStep: {
    title: string;
    mood: string;
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
  classesIntent: string[];
  classesHeld: string[];
  stockHeldClasses: string[];
  cryptoHeldClass: string;
  propertyHeldClass: string;
  p2pHeldClass: string;
  defaultDebtName: string;
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
  debtsTypes: {
    title: 'Was für Schulden? 📒',
    mood: 'Einfach antippen — mehrfach möglich.',
    consumer: 'Dispo / Konsum',
    house: 'Hauskredit / Immobilie',
  },
  debtsCount: {
    title: 'Wie viele Kredite / Schulden? 🔢',
    mood: 'Schätzung reicht — du kannst alles später feinjustieren.',
    placeholder: 'oder andere Zahl (max. 12)',
  },
  debtsEntries: {
    title: 'Kreditdetails ✍️',
    hint: 'Landet direkt in deinem Schuldentracker — ein kleiner Schritt, große Klarheit.',
    loanN: (n) => `${n}. Kredit`,
    consumer: 'Dispo / Konsum',
    house: 'Hauskredit',
    namePlaceholder: 'Name (z. B. Dispokredit)',
    totalPlaceholder: (sym) => `Höhe Gesamt (${sym})`,
    monthlyPlaceholder: (sym) => `Rate monatlich (${sym})`,
  },
  emergencyYn: {
    titleAlone: 'Hast du ein Notgroschen? 🛟',
    titlePartner: 'Habt ihr ein Notgroschen? 🛟',
    mood: 'Polster = Ruhe im Kopf — wir rechnen dir ein sinnvolles Ziel aus.',
    targetHint: (target) => `Empfehlung: 2–3 Monatsgehälter als Polster. Zielvorschlag: ca. ${target} (2,5× Netto).`,
  },
  emergencyBalance: {
    title: 'Wie hoch ist der aktuelle Stand? 💰',
    mood: 'Nice — du hast schon was liegen! 🙌',
    placeholder: (sym) => sym,
  },
  emergencyMonthly: {
    titleAlone: 'Wie viel möchtest du monatlich ins Notgroschen legen? 📅',
    titlePartner: 'Wie viel möchtet ihr monatlich ins Notgroschen legen? 📅',
    mood: 'Jeder Euro zählt — auch kleine Beträge summieren sich.',
    placeholder: (sym) => `${sym} / Monat`,
  },
  splashFocus: {
    debtTitle: 'Fokus: Schulden zuerst 🎯',
    emergencyTitle: 'Fokus: Notgroschen aufbauen 🌱',
    mood: 'Kurz erklärt — danach geht\'s entspannt weiter.',
    debtBody:
      'Investment-Themen überspringen wir vorerst. Unter „LevelUp“ siehst du nichts, bis alle Schulden beglichen sind — damit du dich voll auf die Tilgung konzentrieren kannst.',
    emergencyBody: (target) =>
      `Ohne Notgroschen überspringen wir die Investment-Fragen im Onboarding — LevelUp (Portfolio, Orders, Live-Kurse) bleibt für dich trotzdem nutzbar. Bitte baut parallel euren Notgroschen unter Home auf (⋮ → „Stand bearbeiten“, Ziel ca. ${target}).`,
    btn: 'Alles klar — weiter 😊',
  },
  investExperienced: {
    title: 'Schon mal in Investieren reingeschaut? 📈',
    mood: 'Kein Urteil — nur passende nächste Schritte.',
  },
  investTopics: {
    title: 'Womit beschäftigst du dich? 🧭',
    mood: 'Mehrfachwahl — nimm alles, was dich neugierig macht.',
    otherPlaceholder: 'Sonstiges (kurz)',
  },
  investAmount: {
    title: 'Wie viel hast du ca. investiert? 🪙',
    hint: 'Noch gar nicht? Einfach 0 — auch das ist ein guter Start 🙂',
    placeholder: (sym) => sym,
  },
  investMonthly: {
    title: 'Wie viel möchtest du monatlich investieren? 🐖',
    mood: 'Sparstrumpf-Modus: auch 25 €/Monat sind ein Ritual mit Wirkung.',
    placeholder: (sym) => `${sym} / Monat`,
  },
  investRisk: {
    title: 'Risikoprofil — wie wild darf\'s sein? 🎢',
    mood: 'Du kannst das später jederzeit anpassen.',
    low: 'Wenig Risiko (konservativ)',
    mid: 'Mittel (ausgewogen)',
    high: 'Viel Risiko (aggressiv)',
  },
  investClassesIntent: {
    title: 'In was möchtest du investieren? 🧩',
    mood: 'Träume groß — wir halten die Übersicht klein und übersichtlich.',
  },
  investClassesHeld: {
    title: 'In was bist du investiert? 🗂️',
    mood: 'Alles, was schon in deinem Depot oder Kopf herumspukt.',
    otherPlaceholder: 'Sonstiges',
  },
  investDetails: {
    title: 'Details zu deinen Positionen 🔍',
    mood: 'Optional — aber hilft für Watchlist und Übersicht.',
    hint: 'Optional: jede Zeile einem Watchlist-Symbol zuordnen (Kaufpreis × Stückzahl = EUR in der App). Leer = automatische Verteilung.',
    stockLabel: 'Aktien / ETF / Anleihen',
    cryptoLabel: 'Krypto',
    propertyLabel: 'Immobilien',
    p2pLabel: 'P2P',
    nameStockPlaceholder: 'Name (z. B. Apple, MSCI World)',
    buyPricePlaceholder: (sym) => `Kaufpreis ${sym}`,
    qtyPlaceholder: 'Stückzahl',
    qtyCryptoPlaceholder: 'Stück',
    watchlistAuto: 'Watchlist: automatisch',
    watchlistCryptoAuto: 'Watchlist: automatisch (55 % BTC / 45 % ETH)',
    watchlistPropertyAuto: 'Watchlist-Anteil: automatisch (6 % Kaufpreis → MSCI/SPY)',
    watchlistPropertyOn: (sym) => `Anteil auf ${sym}`,
    watchlistP2pAuto: 'Watchlist: automatisch (Mix)',
    watchlistP2pOn: (sym) => `Gesamtinvest auf ${sym}`,
    addPosition: '+ Position',
    addCrypto: '+ Krypto',
    addProperty: '+ Immobilie',
    propertyLocationPlaceholder: 'Ort / PLZ',
    propertyStreetPlaceholder: 'Straße',
    propertyAreaPlaceholder: 'Wohnfläche m²',
    propertyRentPlaceholder: (sym) => `Kaltmiete ${sym}`,
    propertyUtilitiesPlaceholder: (sym) => `Nebenkosten ${sym}`,
    propertyRaiseDatePlaceholder: 'Letzte Mieterhöhung (Datum)',
    propertyRaiseCyclePlaceholder: 'Erhöhungszyklus (z. B. 3 Jahre)',
    cryptoNamePlaceholder: 'Name / Kürzel',
    p2pTotalPlaceholder: (sym) => `Gesamtinvest ${sym}`,
    p2pProfitPlaceholder: 'Profit %',
  },
  whyHereStep: {
    title: 'Warum bist du hier? 💬',
    mood: 'Damit wir die App für dich noch passender machen.',
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
  classesIntent: ["ETF's", 'Aktien', 'Krypto', 'Anleihen', 'Lebensversicherung', 'Immobilien', 'Sonstiges'],
  classesHeld: ['Aktien', "ETF's", 'Krypto', 'Anleihen', 'Immobilien', 'P2P', 'Sonstiges'],
  stockHeldClasses: ['Aktien', "ETF's", 'Anleihen'],
  cryptoHeldClass: 'Krypto',
  propertyHeldClass: 'Immobilien',
  p2pHeldClass: 'P2P',
  defaultDebtName: 'Dispokredit',
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
  debtsTypes: {
    title: 'What kind of debts? 📒',
    mood: 'Tap to select — multiple choices allowed.',
    consumer: 'Overdraft / consumer credit',
    house: 'Mortgage / property',
  },
  debtsCount: {
    title: 'How many loans / debts? 🔢',
    mood: 'An estimate is fine — you can fine-tune later.',
    placeholder: 'or another number (max. 12)',
  },
  debtsEntries: {
    title: 'Loan details ✍️',
    hint: 'Goes straight into your debt tracker — a small step, big clarity.',
    loanN: (n) => `Loan ${n}`,
    consumer: 'Overdraft / consumer',
    house: 'Mortgage',
    namePlaceholder: 'Name (e.g. overdraft)',
    totalPlaceholder: (sym) => `Total amount (${sym})`,
    monthlyPlaceholder: (sym) => `Monthly payment (${sym})`,
  },
  emergencyYn: {
    titleAlone: 'Do you have an emergency fund? 🛟',
    titlePartner: 'Do you have an emergency fund? 🛟',
    mood: 'A cushion = peace of mind — we\'ll suggest a sensible target.',
    targetHint: (target) => `Recommendation: 2–3 months\' salary as cushion. Suggested target: about ${target} (2.5× net).`,
  },
  emergencyBalance: {
    title: 'What is the current balance? 💰',
    mood: 'Nice — you already have something set aside! 🙌',
    placeholder: (sym) => sym,
  },
  emergencyMonthly: {
    titleAlone: 'How much do you want to put into your emergency fund monthly? 📅',
    titlePartner: 'How much do you want to put into your emergency fund monthly? 📅',
    mood: 'Every bit counts — small amounts add up.',
    placeholder: (sym) => `${sym} / month`,
  },
  splashFocus: {
    debtTitle: 'Focus: debts first 🎯',
    emergencyTitle: 'Focus: build emergency fund 🌱',
    mood: 'Quick explanation — then we continue at your pace.',
    debtBody:
      'We\'ll skip investment topics for now. Under LevelUp you won\'t see anything until all debts are paid — so you can focus fully on repayment.',
    emergencyBody: (target) =>
      `Without an emergency fund we skip investment questions in onboarding — LevelUp (portfolio, orders, live prices) stays available. Please build your emergency fund on Home in parallel (⋮ → "Edit balance", target about ${target}).`,
    btn: 'Got it — continue 😊',
  },
  investExperienced: {
    title: 'Have you looked into investing before? 📈',
    mood: 'No judgment — just the right next steps.',
  },
  investTopics: {
    title: 'What are you interested in? 🧭',
    mood: 'Multiple choice — pick everything that sparks curiosity.',
    otherPlaceholder: 'Other (brief)',
  },
  investAmount: {
    title: 'Roughly how much have you invested? 🪙',
    hint: 'Nothing yet? Just enter 0 — that\'s a fine start 🙂',
    placeholder: (sym) => sym,
  },
  investMonthly: {
    title: 'How much do you want to invest monthly? 🐖',
    mood: 'Savings mode: even €25/month is a ritual that matters.',
    placeholder: (sym) => `${sym} / month`,
  },
  investRisk: {
    title: 'Risk profile — how bold can it be? 🎢',
    mood: 'You can change this anytime later.',
    low: 'Low risk (conservative)',
    mid: 'Medium (balanced)',
    high: 'High risk (aggressive)',
  },
  investClassesIntent: {
    title: 'What do you want to invest in? 🧩',
    mood: 'Dream big — we keep the overview small and clear.',
  },
  investClassesHeld: {
    title: 'What are you invested in? 🗂️',
    mood: 'Everything already in your depot or on your mind.',
    otherPlaceholder: 'Other',
  },
  investDetails: {
    title: 'Details about your positions 🔍',
    mood: 'Optional — but helps with watchlist and overview.',
    hint: 'Optional: map each row to a watchlist symbol (buy price × quantity = EUR in the app). Empty = automatic allocation.',
    stockLabel: 'Stocks / ETF / bonds',
    cryptoLabel: 'Crypto',
    propertyLabel: 'Real estate',
    p2pLabel: 'P2P',
    nameStockPlaceholder: 'Name (e.g. Apple, MSCI World)',
    buyPricePlaceholder: (sym) => `Buy price ${sym}`,
    qtyPlaceholder: 'Quantity',
    qtyCryptoPlaceholder: 'Units',
    watchlistAuto: 'Watchlist: automatic',
    watchlistCryptoAuto: 'Watchlist: automatic (55% BTC / 45% ETH)',
    watchlistPropertyAuto: 'Watchlist share: automatic (6% purchase price → MSCI/SPY)',
    watchlistPropertyOn: (sym) => `Share on ${sym}`,
    watchlistP2pAuto: 'Watchlist: automatic (mix)',
    watchlistP2pOn: (sym) => `Total investment on ${sym}`,
    addPosition: '+ Position',
    addCrypto: '+ Crypto',
    addProperty: '+ Property',
    propertyLocationPlaceholder: 'City / ZIP',
    propertyStreetPlaceholder: 'Street',
    propertyAreaPlaceholder: 'Living area m²',
    propertyRentPlaceholder: (sym) => `Net rent ${sym}`,
    propertyUtilitiesPlaceholder: (sym) => `Utilities ${sym}`,
    propertyRaiseDatePlaceholder: 'Last rent increase (date)',
    propertyRaiseCyclePlaceholder: 'Increase cycle (e.g. 3 years)',
    cryptoNamePlaceholder: 'Name / ticker',
    p2pTotalPlaceholder: (sym) => `Total invested ${sym}`,
    p2pProfitPlaceholder: 'Profit %',
  },
  whyHereStep: {
    title: 'Why are you here? 💬',
    mood: 'So we can tailor the app even better for you.',
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
  classesIntent: ['ETFs', 'Stocks', 'Crypto', 'Bonds', 'Life insurance', 'Real estate', 'Other'],
  classesHeld: ['Stocks', 'ETFs', 'Crypto', 'Bonds', 'Real estate', 'P2P', 'Other'],
  stockHeldClasses: ['Stocks', 'ETFs', 'Bonds'],
  cryptoHeldClass: 'Crypto',
  propertyHeldClass: 'Real estate',
  p2pHeldClass: 'P2P',
  defaultDebtName: 'Overdraft',
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
