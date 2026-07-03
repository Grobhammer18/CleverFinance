import { useState, type CSSProperties } from 'react';
import { allwinPalette as awBg } from '../theme/allwinPalette';
import type { AppLocale } from '../i18n/locale';
import { t as translate } from '../i18n/messages';

/** Spardose („Dosen-Feature") — Ziel mit Füllstand und Prozent-Anteil bei Verteilungen. */
export type SavingsJar = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  current: number;
  /** Anteil (0–100) bei „Betrag verteilen"; Summe aller Dosen ≤ 100 */
  percentage: number;
  color?: string;
};

const JAR_COLORS = ['#2563eb', '#a855f7', '#f0883e', '#3fb950', '#5b93ff', '#f8d03a'];

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

const chipStyle: CSSProperties = {
  background: awBg.chipOff,
  border: `1px solid ${awBg.line}`,
  borderRadius: 10,
  padding: '8px 12px',
  color: '#e6edf3',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

function parseAmount(raw: string): number {
  const n = parseFloat(String(raw).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** Glas mit Füllstand von unten. */
function JarGlass({ pct, color }: { pct: number; color: string }) {
  const fill = Math.max(0, Math.min(100, pct));
  return (
    <div
      aria-hidden
      style={{
        width: 44,
        height: 60,
        borderRadius: '6px 6px 14px 14px',
        border: `2px solid ${awBg.line}`,
        borderTopWidth: 4,
        background: awBg.hole,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${fill}%`,
          background: `linear-gradient(180deg, ${color}cc 0%, ${color} 100%)`,
          transition: 'height 0.6s ease',
        }}
      />
      {fill >= 100 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          ✨
        </div>
      )}
    </div>
  );
}

type DraftJar = { id: string | null; name: string; emoji: string; target: string; percentage: string };

const EMPTY_DRAFT: DraftJar = { id: null, name: '', emoji: '🫙', target: '', percentage: '' };

type Props = {
  locale: AppLocale;
  jars: SavingsJar[];
  fmt: (n: number) => string;
  onChange: (jars: SavingsJar[]) => void;
  onGoalReached: (jar: SavingsJar) => void;
  onInvalid: (msg: string) => void;
};

export default function SavingsJars({ locale, jars, fmt, onChange, onGoalReached, onInvalid }: Props) {
  const tr = (key: string, vars?: Record<string, string>) => translate(key, locale, vars);
  const [open, setOpen] = useState(jars.length > 0);
  const [draft, setDraft] = useState<DraftJar | null>(null);
  const [distributeAmount, setDistributeAmount] = useState('');

  const percentSum = jars.reduce((s, j) => s + j.percentage, 0);

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const target = parseAmount(draft.target);
    const pct = Math.max(0, Math.min(100, Math.round(parseFloat(draft.percentage.replace(',', '.')) || 0)));
    if (!name || target <= 0) {
      onInvalid(tr('jars.invalid'));
      return;
    }
    const othersSum = jars.filter((j) => j.id !== draft.id).reduce((s, j) => s + j.percentage, 0);
    if (othersSum + pct > 100) {
      onInvalid(tr('jars.percentTooHigh'));
      return;
    }
    if (draft.id) {
      onChange(jars.map((j) => (j.id === draft.id ? { ...j, name, emoji: draft.emoji || '🫙', target, percentage: pct } : j)));
    } else {
      const color = JAR_COLORS[jars.length % JAR_COLORS.length];
      onChange([
        ...jars,
        { id: `jar-${Date.now()}`, name, emoji: draft.emoji || '🫙', target, current: 0, percentage: pct, color },
      ]);
    }
    setDraft(null);
  };

  const removeJar = (jar: SavingsJar) => {
    if (!window.confirm(tr('jars.deleteConfirm', { name: jar.name }))) return;
    onChange(jars.filter((j) => j.id !== jar.id));
  };

  const distribute = () => {
    const amount = parseAmount(distributeAmount);
    if (amount <= 0) {
      onInvalid(tr('jars.invalid'));
      return;
    }
    const withShare = jars.filter((j) => j.percentage > 0);
    if (withShare.length === 0) {
      onInvalid(tr('jars.distributeNoPercent'));
      return;
    }
    let reached: SavingsJar | null = null;
    const next = jars.map((j) => {
      if (j.percentage <= 0) return j;
      const add = Math.round(amount * j.percentage) / 100;
      const updated = { ...j, current: Math.round((j.current + add) * 100) / 100 };
      if (!reached && j.current < j.target && updated.current >= updated.target) reached = updated;
      return updated;
    });
    onChange(next);
    setDistributeAmount('');
    if (reached) onGoalReached(reached);
  };

  return (
    <div data-tour="home-jars" style={cardStyle}>
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
        <div style={labelStyle}>{tr('jars.cardTitle')}</div>
        <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, flexShrink: 0 }}>
          {jars.length > 0 ? `${jars.length} ` : ''}
          {open ? '▼' : '▶'}
        </span>
      </button>

      {open && (
        <>
          <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4, marginBottom: 12, lineHeight: 1.5 }}>
            {tr('jars.intro')}
          </div>

          {jars.length === 0 && !draft && (
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 12, lineHeight: 1.55 }}>{tr('jars.empty')}</div>
          )}

          {jars.map((jar) => {
            const pct = jar.target > 0 ? (jar.current / jar.target) * 100 : 0;
            const color = jar.color || '#2563eb';
            const full = jar.current >= jar.target && jar.target > 0;
            return (
              <div
                key={jar.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: `1px solid ${awBg.cardBorder}`,
                }}
              >
                <JarGlass pct={pct} color={color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>
                      {jar.emoji} {jar.name}
                    </span>
                    {full && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#3fb950', border: '1px solid #3fb95055', borderRadius: 6, padding: '2px 6px' }}>
                        {tr('jars.fullBadge')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#8b949e', marginTop: 3 }}>
                    {fmt(jar.current)} {tr('jars.of')} {fmt(jar.target)} · {Math.min(999, Math.round(pct))} %
                  </div>
                  <div style={{ fontSize: 11, color: '#6e7681', marginTop: 2 }}>
                    {tr('jars.shareLine', { pct: String(jar.percentage) })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    aria-label={tr('jars.edit')}
                    style={{ ...chipStyle, padding: '5px 10px', fontSize: 11 }}
                    onClick={() =>
                      setDraft({
                        id: jar.id,
                        name: jar.name,
                        emoji: jar.emoji,
                        target: String(jar.target).replace('.', ','),
                        percentage: String(jar.percentage),
                      })
                    }
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    aria-label={tr('jars.delete')}
                    style={{ ...chipStyle, padding: '5px 10px', fontSize: 11, color: '#ff7b7b' }}
                    onClick={() => removeJar(jar)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          {draft ? (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, width: 64, textAlign: 'center', flexShrink: 0 }}
                  value={draft.emoji}
                  maxLength={4}
                  aria-label={tr('jars.emoji')}
                  onChange={(e) => setDraft((d) => (d ? { ...d, emoji: e.target.value } : d))}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={tr('jars.namePh')}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  inputMode="decimal"
                  placeholder={tr('jars.target')}
                  value={draft.target}
                  onChange={(e) => setDraft((d) => (d ? { ...d, target: e.target.value } : d))}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  inputMode="numeric"
                  placeholder={tr('jars.percent')}
                  value={draft.percentage}
                  onChange={(e) => setDraft((d) => (d ? { ...d, percentage: e.target.value } : d))}
                />
              </div>
              <div style={{ fontSize: 11, color: percentSum > 100 ? '#ff7b7b' : '#6e7681' }}>
                {tr('jars.percentHint', { sum: String(percentSum) })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: '#2563eb',
                    color: '#fff',
                    border: '1px solid #ffffff22',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  onClick={saveDraft}
                >
                  {tr('common.save')}
                </button>
                <button type="button" style={{ ...chipStyle, flex: 1 }} onClick={() => setDraft(null)}>
                  {tr('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" style={{ ...chipStyle, marginTop: 12, width: '100%' }} onClick={() => setDraft(EMPTY_DRAFT)}>
              {tr('jars.add')}
            </button>
          )}

          {jars.some((j) => j.percentage > 0) && !draft && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${awBg.cardBorder}` }}>
              <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, marginBottom: 8 }}>{tr('jars.distribute')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  inputMode="decimal"
                  placeholder={tr('jars.distributeAmountPh')}
                  value={distributeAmount}
                  onChange={(e) => setDistributeAmount(e.target.value)}
                />
                <button
                  type="button"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: '1px solid #ffffff22',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  onClick={distribute}
                >
                  {tr('jars.distributeBtn')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
