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
      'Kurz die wichtigsten Stellen — mit Licht und Sprechblase. Neu dabei: Kassenzettel-Scan, Sprache & Währung, Urlaubsmodus und Einstellungen, die direkt aufklappen. Du kannst jederzeit überspringen oder die Tour später unter Mehr erneut starten.',
  },
  {
    id: 'nav',
    tab: 'dashboard',
    target: 'tab-bar',
    title: 'Deine Navigation',
    message:
      'Unten wechselst du zwischen Home, Money, Übersicht, Boost, LevelUp und Mehr. Alles ist verknüpft: Buchungen in Money wirken sich auf Home, Übersicht und LevelUp aus.',
  },
  {
    id: 'home-saldo',
    tab: 'dashboard',
    target: 'home-saldo',
    title: 'Home — Monat im Blick',
    message:
      'Einnahmen, Ausgaben und Monatssaldo auf einen Blick. Die Zahlen kommen aus deinen Buchungen unter Money — nichts doppelt eintragen.',
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
    requiresLevelUpUnlocked: true,
  },
  {
    id: 'money-receipt',
    tab: 'transactions',
    target: 'money-receipt',
    title: 'Kassenzettel-Scan',
    message:
      'Beleg fotografieren oder aus der Mediathek wählen — Betrag, Datum und Händler werden erkannt und ins Buchungsformular übernommen. Dafür musst du eingeloggt sein.',
  },
  {
    id: 'money-options',
    tab: 'transactions',
    target: 'money-options',
    title: 'Money — Menü ⋮',
    message:
      'Oben rechts: neue Schuld anlegen (öffnet Boost), Grundwährung wählen und „Im Urlaub“ aktivieren — dann buchst du in Fremdwährung, umgerechnet in deine Heimatwährung.',
  },
  {
    id: 'money',
    tab: 'transactions',
    target: 'money-form',
    title: 'Money — Buchung erfassen',
    message:
      '„Neue Buchung“ aufklappen und Einnahme oder Ausgabe wählen. Tipp: Kategorie „Dividende“ bucht automatisch auf dein Cash Depot. Kreditrate einer Schuld aus Boost zuordnen. Unter „Letzte Buchungen“ Einträge antippen — das Formular scrollt zum Bearbeiten.',
  },
  {
    id: 'charts',
    tab: 'charts',
    target: 'charts-main',
    title: 'Übersicht — Charts',
    message:
      'Jahres-Charts, Vermögensverlauf und Portfolio-Entwicklung. Ideal, um Trends über Monate zu sehen und dein Gesamtbild zu prüfen.',
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
    id: 'profile-settings',
    tab: 'profile',
    target: 'profile-settings',
    title: 'Mehr — Einstellungen',
    message:
      'Sprache, Persönliches, Benachrichtigungen, Feedback und Orden klappst du direkt hier auf — kein Scrollen bis ganz unten. Dein Paket erreichst du oben über ›.',
  },
  {
    id: 'profile-tour',
    tab: 'profile',
    target: 'profile-tour',
    title: 'App-Tour',
    message:
      'Die geführte Tour mit Licht und Sprechblase jederzeit erneut starten — praktisch nach Updates oder wenn du eine Funktion nochmal erklärt haben möchtest.',
  },
  {
    id: 'done',
    title: 'Du bist startklar! 🚀',
    message:
      'Viel Erfolg — leg los mit einem Kassenzettel-Scan oder deiner ersten Buchung unter Money. Bei Fragen einfach die Tour unter Mehr nochmal ansehen.',
  },
];

const EN_STEPS: AppTourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Clever Finance! 🎉',
    message:
      'A quick look at the key spots — with spotlight and tooltip. New: receipt scan, language & currency, vacation mode, and settings that expand in place. Skip anytime or restart the tour later under More.',
  },
  {
    id: 'nav',
    tab: 'dashboard',
    target: 'tab-bar',
    title: 'Your navigation',
    message:
      'Switch between Home, Money, Overview, Boost, LevelUp and More at the bottom. Everything is connected: Money entries affect Home, Overview and LevelUp.',
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
    requiresLevelUpUnlocked: true,
  },
  {
    id: 'money-receipt',
    tab: 'transactions',
    target: 'money-receipt',
    title: 'Receipt scan',
    message:
      'Take a photo or pick from your library — amount, date and merchant are recognized and filled into the booking form. You need to be logged in.',
  },
  {
    id: 'money-options',
    tab: 'transactions',
    target: 'money-options',
    title: 'Money — menu ⋮',
    message:
      'Top right: add a new debt (opens Boost), pick your base currency, and enable "On vacation" — then book in foreign currency, converted to your home currency.',
  },
  {
    id: 'money',
    tab: 'transactions',
    target: 'money-form',
    title: 'Money — add an entry',
    message:
      'Expand "New booking" and choose income or expense. Tip: category "Dividend" books to your cash depot automatically. Link loan payments to a Boost debt. Under "Recent bookings", tap an entry — the form scrolls into view for editing.',
  },
  {
    id: 'charts',
    tab: 'charts',
    target: 'charts-main',
    title: 'Overview — charts',
    message:
      'Year charts, wealth history and portfolio development. Ideal for spotting trends over months and checking the big picture.',
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
    id: 'profile-settings',
    tab: 'profile',
    target: 'profile-settings',
    title: 'More — settings',
    message:
      'Language, personal info, notifications, feedback and badges expand right here — no scrolling to the bottom. Your plan is at the top via ›.',
  },
  {
    id: 'profile-tour',
    tab: 'profile',
    target: 'profile-tour',
    title: 'App tour',
    message:
      'Restart the guided tour with spotlight and tooltip anytime — handy after updates or when you want a feature explained again.',
  },
  {
    id: 'done',
    title: 'You\'re all set! 🚀',
    message:
      'Good luck — start with a receipt scan or your first Money entry. Questions? Run the tour again anytime under More.',
  },
];

/** @deprecated Use getAppTourSteps(locale) */
export const APP_TOUR_STEPS = DE_STEPS;

export function getAppTourSteps(locale: AppLocale): AppTourStep[] {
  return locale === 'en' ? EN_STEPS : DE_STEPS;
}

export const APP_TOUR_STORAGE_KEY = 'allwin.appTourDone';
