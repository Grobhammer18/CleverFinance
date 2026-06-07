import { allwinPalette as P } from '../theme/allwinPalette';
import CleverFinanceLogo from './CleverFinanceLogo';
import { APP_LOCALES, type AppLocale } from '../i18n/locale';
import { useLocale } from '../i18n/LocaleContext';

const W = {
  app: {
    minHeight: '100vh',
    backgroundColor: P.appFallback,
    backgroundImage: P.app,
    color: '#e6edf3',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    maxWidth: 430,
    margin: '0 auto',
    position: 'relative' as const,
    padding: 16,
    paddingBottom: 120,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
  },
  card: { background: P.card, borderRadius: 16, padding: 22, border: `1px solid ${P.cardBorder}` },
  chip: (active: boolean) => ({
    padding: '12px 16px',
    borderRadius: 99,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    border: `1px solid ${active ? '#2563eb' : '#4d5560'}`,
    background: active ? '#2563eb2e' : P.chipOff,
    color: active ? '#93c5fd' : '#d0d7de',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  }),
  btn: {
    background: '#2563eb',
    color: '#0d1117',
    border: '1px solid #00f5c233',
    borderRadius: 10,
    padding: '12px 20px',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
    marginTop: 16,
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
  },
};

type Props = {
  locale: AppLocale;
  onSelect: (locale: AppLocale) => void;
  onContinue: () => void;
};

export default function LanguagePickScreen({ locale, onSelect, onContinue }: Props) {
  const { t } = useLocale();

  return (
    <div style={W.app}>
      <div style={W.card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <CleverFinanceLogo size={96} />
        </div>
        <div style={{ fontSize: 11, color: '#7d8590', textAlign: 'center', marginBottom: 6, fontWeight: 700 }}>
          🌐 Language · Sprache
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', lineHeight: 1.35 }}>{t('language.pickTitle')}</div>
        <div style={{ fontSize: 14, color: '#9aa7b5', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          {t('language.pickSubtitle')}
        </div>
        <div style={{ marginTop: 16 }}>
          {APP_LOCALES.map((opt) => (
            <button key={opt.id} type="button" style={W.chip(locale === opt.id)} onClick={() => onSelect(opt.id)}>
              <span>{opt.native}</span>
              <span>{locale === opt.id ? '✅' : '›'}</span>
            </button>
          ))}
        </div>
        <button type="button" style={W.btn} onClick={onContinue}>
          {t('language.pickContinue')}
        </button>
      </div>
    </div>
  );
}
