export type AppLocale = 'de' | 'en';

export const APP_LOCALES: { id: AppLocale; label: string; native: string }[] = [
  { id: 'de', label: 'Deutsch', native: 'Deutsch' },
  { id: 'en', label: 'English', native: 'English' },
];

const LOCALE_STORAGE_KEY = 'allwin.locale';

export function normalizeLocale(raw: unknown): AppLocale {
  return raw === 'en' ? 'en' : 'de';
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'de';
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  return 'de';
}

export function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'de' || raw === 'en') return raw;
  } catch {
    /* ignore */
  }
  return detectBrowserLocale();
}

export function writeStoredLocale(locale: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function localeToIntlTag(locale: AppLocale): string {
  return locale === 'en' ? 'en-US' : 'de-DE';
}
