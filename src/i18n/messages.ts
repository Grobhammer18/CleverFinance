import type { AppLocale } from './locale';

type MessageLeaf = string;
type MessageTree = { [key: string]: MessageLeaf | MessageTree };

const de: MessageTree = {
  common: {
    continue: 'Weiter',
    save: 'Speichern',
    close: 'Schließen',
    yes: 'Ja',
    no: 'Nein',
    or: 'oder',
    loading: 'Lade…',
  },
  language: {
    pickTitle: 'Welche Sprache sprichst du?',
    pickSubtitle: 'Clever Finance passt sich deiner Sprache an — du kannst sie später unter Mehr ändern.',
    pickContinue: 'Weiter zum Onboarding',
    settingsTitle: 'Sprache',
    settingsHint: 'Menü, Onboarding und zentrale Texte der App.',
    changed: 'Sprache geändert.',
  },
  nav: {
    home: 'Home',
    money: 'Money',
    charts: 'Übersicht',
    boost: 'Boost',
    levelUp: 'LevelUp',
    more: 'Mehr',
  },
  header: {
    tagline: 'Deine Finanzen. Clever gedacht.',
    logout: 'Logout',
  },
  welcome: {
    title: 'Schön, dass du hier bist!',
    subtitle: 'Meistere kinderleicht deine Finanzen.',
    cta: 'Mit E-Mail, Google oder Apple anmelden',
  },
  auth: {
    registerHint: 'Neues Konto — danach kurze Fragen (ca. 5 Min.), dann führt dich eine Tour mit Licht & Sprechblase durch die App. 🎉',
    loginHint: 'Willkommen zurück — melde dich mit E-Mail und Passwort an.',
    login: 'Anmelden',
    register: 'Registrieren',
    loginBtn: '🚀 Jetzt anmelden',
    registerBtn: '🎉 Konto erstellen',
    backWelcome: '← Zurück zum Willkommen',
    loadingAccount: 'Lade Benutzerkonto... ⏳',
    syncing: 'Synchronisiere deine Daten… ⏳',
  },
  profile: {
    personal: '👤 Persönliche Angaben',
    notifications: '🔔 Mitteilungen',
    feedback: '💬 Feedback & Wünsche',
    orden: '🎖️ Meine Orden',
    redeem: '🎁 Code einlösen',
    language: '🌐 Sprache',
    legal: '⚖️ Impressum & Hinweise',
  },
  money: {
    baseCurrency: 'Grundwährung',
    baseCurrencyHint: 'Summen in Money & Home — neue Buchungen starten in dieser Währung.',
  },
};

const en: MessageTree = {
  common: {
    continue: 'Continue',
    save: 'Save',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    loading: 'Loading…',
  },
  language: {
    pickTitle: 'Which language do you speak?',
    pickSubtitle: 'Clever Finance adapts to your language — you can change it later under More.',
    pickContinue: 'Continue to onboarding',
    settingsTitle: 'Language',
    settingsHint: 'Menu, onboarding and core app texts.',
    changed: 'Language updated.',
  },
  nav: {
    home: 'Home',
    money: 'Money',
    charts: 'Overview',
    boost: 'Boost',
    levelUp: 'LevelUp',
    more: 'More',
  },
  header: {
    tagline: 'Your finances. Cleverly thought through.',
    logout: 'Logout',
  },
  welcome: {
    title: 'Great to have you here!',
    subtitle: 'Master your finances with ease.',
    cta: 'Sign in with email, Google or Apple',
  },
  auth: {
    registerHint: 'New account — a few quick questions (~5 min), then a guided tour through the app. 🎉',
    loginHint: 'Welcome back — sign in with email and password.',
    login: 'Sign in',
    register: 'Register',
    loginBtn: '🚀 Sign in now',
    registerBtn: '🎉 Create account',
    backWelcome: '← Back to welcome',
    loadingAccount: 'Loading account… ⏳',
    syncing: 'Syncing your data… ⏳',
  },
  profile: {
    personal: '👤 Personal details',
    notifications: '🔔 Notifications',
    feedback: '💬 Feedback & wishes',
    orden: '🎖️ My badges',
    redeem: '🎁 Redeem code',
    language: '🌐 Language',
    legal: '⚖️ Legal & notices',
  },
  money: {
    baseCurrency: 'Base currency',
    baseCurrencyHint: 'Totals in Money & Home — new entries start in this currency.',
  },
};

const catalogs: Record<AppLocale, MessageTree> = { de, en };

function getNested(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let cur: string | MessageTree | undefined = tree;
  for (const p of parts) {
    if (!cur || typeof cur === 'string') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Übersetzung mit Fallback auf Deutsch. */
export function t(key: string, locale: AppLocale, vars?: Record<string, string>): string {
  let text = getNested(catalogs[locale], key) ?? getNested(catalogs.de, key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return text;
}
