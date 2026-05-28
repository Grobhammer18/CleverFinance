/** Schritte für die In-App-Tour (Spotlight + Sprechblase). */
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

export const APP_TOUR_STEPS: AppTourStep[] = [
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

export const APP_TOUR_STORAGE_KEY = 'allwin.appTourDone';
