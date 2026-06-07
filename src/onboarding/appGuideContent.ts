import type { AppLocale } from '../i18n/locale';

export type AppTourStep = {
  id: string;
  /** Tab wechseln vor dem Highlight */
  tab?: string;
  /** `data-tour="…"` am Ziel-Element */
  target?: string;
  title: string;
  message: string;
  /** Nur anzeigen, wenn Bedingung erfüllt */
  requiresOpenDebts?: boolean;
  requiresLevelUpUnlocked?: boolean;
};

const DE_STEPS: AppTourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei Clever Finance! 🎉',
    message:
      'Kurz die wichtigsten Stellen — mit Licht und Sprechblase. Du kannst jederzeit überspringen oder später unter Mehr die Tour erneut starten.',
  },
  {
    id: 'nav',
    tab: 'dashboard',
    target: 'tab-bar',
    title: 'Deine Navigation',
    message:
      'Unten wechselst du zwischen den Bereichen. Alles ist miteinander verknüpft: Buchungen in Money wirken sich auf Home und LevelUp aus.',
  },
  {
    id: 'home-saldo',
    tab: 'dashboard',
    target: 'home-saldo',
    title: 'Home — Monat im Blick',
    message:
      'Hier siehst du Einnahmen, Ausgaben und den Monatssaldo. Die Zahlen kommen aus deinen Buchungen unter Money — nichts doppelt eintragen.',
  },
  {
    id: 'home-notgroschen',
    tab: 'dashboard',
    target: 'home-notgroschen',
    title: 'Notgroschen',
    message:
      'Dein Sicherheitspolster mit Fortschrittsbalken. Stand anpassen: oben rechts auf der Karte ⋮ → „Stand bearbeiten“.',
  },
  {
    id: 'home-portfolio',
    tab: 'dashboard',
    target: 'home-portfolio',
    title: 'Portfolio Power (Kurzüberblick)',
    message:
      'Gesamt = investierte Positionen + Cash Depot. Details, Orders und Live-Kurse findest du unter LevelUp.',
  },
  {
    id: 'money',
    tab: 'transactions',
    target: 'money-form',
    title: 'Money — Buchungen',
    message:
      'Einnahmen und Ausgaben erfassen. Tipp: Kategorie „Dividende“ bucht automatisch auf dein Cash Depot. Kreditrate kannst du einer Schuld aus Boost zuordnen.',
  },
  {
    id: 'charts',
    tab: 'charts',
    target: 'charts-main',
    title: 'Übersicht — Charts',
    message:
      'Jahres-Charts, Vermögensverlauf und Portfolio-Entwicklung. Ideal, um Trends über Monate zu sehen.',
  },
  {
    id: 'boost',
    tab: 'debts',
    target: 'boost-debts',
    title: 'Boost — Schulden',
    message: 'Schulden anlegen, Raten tilgen oder komplett abbezahlen. Abbezahlte Kredite landen im Archiv.',
    requiresOpenDebts: true,
  },
  {
    id: 'levelup',
    tab: 'invest',
    target: 'portfolio-power',
    title: 'LevelUp — Portfolio',
    message:
      'Portfolio Power (Gesamt inkl. Cash Depot), Orders in Stückzahl und Live-Marktdaten. Cash Depot bearbeiten: ⋮ oben rechts an der Karte.',
    requiresLevelUpUnlocked: true,
  },
  {
    id: 'profile',
    tab: 'profile',
    target: 'profile-main',
    title: 'Mehr — Profil & Abo',
    message: 'Profil, Abo, Benachrichtigungen und Einstellungen. Hier kannst du auch die App-Tour erneut starten.',
  },
  {
    id: 'done',
    title: 'Du bist startklar! 🚀',
    message: 'Viel Erfolg — leg los mit deiner ersten Buchung unter Money oder schau dir LevelUp an. Bei Fragen einfach die Tour nochmal ansehen.',
  },
];

const EN_STEPS: AppTourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Clever Finance! 🎉',
    message:
      'A quick look at the key spots — with spotlight and tooltip. You can skip anytime or restart the tour later under More.',
  },
  {
    id: 'nav',
    tab: 'dashboard',
    target: 'tab-bar',
    title: 'Your navigation',
    message:
      'Switch areas at the bottom. Everything is connected: Money entries affect Home and LevelUp.',
  },
  {
    id: 'home-saldo',
    tab: 'dashboard',
    target: 'home-saldo',
    title: 'Home — month at a glance',
    message:
      'See income, expenses and monthly balance here. Numbers come from your Money entries — no double entry.',
  },
  {
    id: 'home-notgroschen',
    tab: 'dashboard',
    target: 'home-notgroschen',
    title: 'Emergency fund',
    message:
      'Your safety cushion with progress bar. Adjust balance: top right on the card ⋮ → "Edit balance".',
  },
  {
    id: 'home-portfolio',
    tab: 'dashboard',
    target: 'home-portfolio',
    title: 'Portfolio Power (quick view)',
    message:
      'Total = invested positions + cash depot. Details, orders and live prices are under LevelUp.',
  },
  {
    id: 'money',
    tab: 'transactions',
    target: 'money-form',
    title: 'Money — entries',
    message:
      'Record income and expenses. Tip: category "Dividend" books to your cash depot automatically. Loan payments can link to a Boost debt.',
  },
  {
    id: 'charts',
    tab: 'charts',
    target: 'charts-main',
    title: 'Overview — charts',
    message:
      'Year charts, wealth history and portfolio development. Ideal for spotting trends over months.',
  },
  {
    id: 'boost',
    tab: 'debts',
    target: 'boost-debts',
    title: 'Boost — debts',
    message: 'Add debts, pay installments or pay off completely. Paid-off loans go to the archive.',
    requiresOpenDebts: true,
  },
  {
    id: 'levelup',
    tab: 'invest',
    target: 'portfolio-power',
    title: 'LevelUp — portfolio',
    message:
      'Portfolio Power (total incl. cash depot), orders in shares and live market data. Edit cash depot: ⋮ top right on the card.',
    requiresLevelUpUnlocked: true,
  },
  {
    id: 'profile',
    tab: 'profile',
    target: 'profile-main',
    title: 'More — profile & plan',
    message: 'Profile, subscription, notifications and settings. You can restart the app tour here too.',
  },
  {
    id: 'done',
    title: 'You\'re all set! 🚀',
    message: 'Good luck — start with your first Money entry or explore LevelUp. Questions? Just run the tour again.',
  },
];

/** @deprecated Use getAppTourSteps(locale) */
export const APP_TOUR_STEPS = DE_STEPS;

export function getAppTourSteps(locale: AppLocale): AppTourStep[] {
  return locale === 'en' ? EN_STEPS : DE_STEPS;
}

export const APP_TOUR_STORAGE_KEY = 'allwin.appTourDone';
