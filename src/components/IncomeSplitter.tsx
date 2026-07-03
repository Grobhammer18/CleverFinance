import { useState, type CSSProperties } from 'react';
import { allwinPalette as awBg } from '../theme/allwinPalette';
import type { AppLocale } from '../i18n/locale';
import { t as translate } from '../i18n/messages';

const cardStyle: CSSProperties = {
  background: awBg.card,
  borderRadius: 16,
  padding: 18,
  marginBottom: 12,
  border: `1px solid ${awBg.cardBorder}`,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: '#7d8590',
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: awBg.field,
  border: `1px solid ${awBg.line}`,
  borderRadius: 10,
  padding: '10px 14px',
  color: '#e6edf3',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const actionBtnStyle: CSSProperties = {
  background: awBg.chipOff,
  border: `1px solid ${awBg.line}`,
  borderRadius: 10,
  padding: '10px 12px',
  color: '#e6edf3',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  flex: '1 1 140px',
  minWidth: 0,
};

function parseAmount(raw: string): number {
  const n = parseFloat(String(raw).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

type Props = {
  locale: AppLocale;
  /** Schulden-Anteil in % (10–90) */
  ratio: number;
  onRatioChange: (n: number) => void;
  fmt: (n: number) => string;
  hasOpenDebts: boolean;
  hasJars: boolean;
  onGoToBoost: () => void;
  onDistributeToJars: (amount: number) => void;
  onBookAsIncome: (amount: number) => void;
  onInvalid: (msg: string) => void;
};

export default function IncomeSplitter({
  locale,
  ratio,
  onRatioChange,
  fmt,
  hasOpenDebts,
  hasJars,
  onGoToBoost,
  onDistributeToJars,
  onBookAsIncome,
  onInvalid,
}: Props) {
  const tr = (key: string, vars?: Record<string, string>) => translate(key, locale, vars);
  const [open, setOpen] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [splitAmount, setSplitAmount] = useState<number | null>(null);

  const investRatio = 100 - ratio;
  const debtPart = splitAmount != null ? Math.round(splitAmount * ratio) / 100 : 0;
  const investPart = splitAmount != null ? Math.round((splitAmount * 100 - Math.round(splitAmount * ratio))) / 100 : 0;

  const doSplit = () => {
    const n = parseAmount(amountStr);
    if (n <= 0) {
      onInvalid(tr('splitter.invalidAmount'));
      return;
    }
    setSplitAmount(n);
  };

  return (
    <div data-tour="money-splitter" style={cardStyle}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={labelStyle}>{tr('splitter.cardTitle')}</div>
        <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <>
          <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4, marginBottom: 12, lineHeight: 1.5 }}>
            {tr('splitter.intro')}
          </div>

          <input
            style={{ ...inputStyle, marginBottom: 10 }}
            inputMode="decimal"
            placeholder={tr('splitter.amountPh')}
            value={amountStr}
            onChange={(e) => {
              setAmountStr(e.target.value);
              setSplitAmount(null);
            }}
          />

          <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, marginBottom: 6 }}>
            {tr('splitter.ratioLabel', { debt: String(ratio), invest: String(investRatio) })}
          </div>
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={ratio}
            aria-label={tr('splitter.ratioLabel', { debt: String(ratio), invest: String(investRatio) })}
            onChange={(e) => {
              onRatioChange(Number(e.target.value));
              setSplitAmount(null);
            }}
            style={{ width: '100%', accentColor: '#2563eb', marginBottom: 12 }}
          />

          <button
            type="button"
            style={{
              width: '100%',
              background: '#2563eb',
              color: '#fff',
              border: '1px solid #ffffff22',
              borderRadius: 10,
              padding: '12px 14px',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
            onClick={doSplit}
          >
            {tr('splitter.split')}
          </button>

          {splitAmount != null && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div
                  style={{
                    flex: ratio,
                    background: '#2e1608',
                    border: '1px solid #f0883e44',
                    borderRadius: 12,
                    padding: '12px 10px',
                    minWidth: 0,
                    transition: 'flex 0.4s ease',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#f0883e', fontWeight: 700 }}>
                    ⚡ {tr('splitter.debtSide')} {ratio} %
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: '#e6edf3' }}>{fmt(debtPart)}</div>
                </div>
                <div
                  style={{
                    flex: investRatio,
                    background: '#101e38',
                    border: '1px solid #2563eb55',
                    borderRadius: 12,
                    padding: '12px 10px',
                    minWidth: 0,
                    transition: 'flex 0.4s ease',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#5b93ff', fontWeight: 700 }}>
                    📈 {tr('splitter.investSide')} {investRatio} %
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: '#e6edf3' }}>{fmt(investPart)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {hasOpenDebts && (
                  <button type="button" style={actionBtnStyle} onClick={onGoToBoost}>
                    {tr('splitter.toBoost')}
                  </button>
                )}
                {hasJars && (
                  <button type="button" style={actionBtnStyle} onClick={() => onDistributeToJars(investPart)}>
                    {tr('splitter.toJars')}
                  </button>
                )}
                <button type="button" style={actionBtnStyle} onClick={() => onBookAsIncome(splitAmount)}>
                  {tr('splitter.asIncome')}
                </button>
              </div>

              <div style={{ fontSize: 11, color: '#6e7681', marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' }}>
                {tr('splitter.quote')}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
