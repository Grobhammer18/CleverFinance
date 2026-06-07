import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { t as translate } from './messages';
import type { AppLocale } from './locale';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  setLocale,
  children,
}: {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: Record<string, string>) => translate(key, locale, vars),
    }),
    [locale, setLocale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale requires LocaleProvider');
  return ctx;
}

/** Optional — außerhalb Provider Fallback Deutsch. */
export function useLocaleOptional(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  const fallback = useMemo(
    () => ({
      locale: 'de' as AppLocale,
      setLocale: () => {},
      t: (key: string, vars?: Record<string, string>) => translate(key, 'de', vars),
    }),
    [],
  );
  return ctx ?? fallback;
}
