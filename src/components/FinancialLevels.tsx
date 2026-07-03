import { useState, type CSSProperties } from 'react';
import { allwinPalette as awBg } from '../theme/allwinPalette';
import type { AppLocale } from '../i18n/locale';
import { t as translate } from '../i18n/messages';

const cardStyle: CSSProperties = {
  background: awBg.card,
  borderRadius: 16,
  padding: 18,
  marginBottom: 12,
  border: '1px solid #f8d03a33',
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

function parseAmount(raw: string): number {
  const n = parseFloat(String(raw).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

type LevelDef = {
  id: 1 | 2 | 3;
  emoji: string;
  nameKey: string;
  goalKey: string;
  bodyKey: string;
  color: string;
  target: number;
  current: number;
  /** 0/40/100-Verteilung risikoarm/mittel/riskant in % */
  alloc: [number, number, number];
};

type Props = {
  locale: AppLocale;
  /** Wirksame Monatskosten; 0 = unbekannt */
  monthlyExpenses: number;
  /** true wenn manuell gesetzt (sonst automatisch geschätzt) */
  isManualExpenses: boolean;
  /** Ø-Ausgaben aus Buchungen als Vorschlag; 0 = keine Daten */
  suggestedExpenses: number;
  notgroschenBalance: number;
  portfolioTotalPower: number;
  fmt: (n: number) => string;
  onSaveMonthlyExpenses: (n: number) => void;
  onInvalid: (msg: string) => void;
};

export default function FinancialLevels({
  locale,
  monthlyExpenses,
  isManualExpenses,
  suggestedExpenses,
  notgroschenBalance,
  portfolioTotalPower,
  fmt,
  onSaveMonthlyExpenses,
  onInvalid,
}: Props) {
  const tr = (key: string, vars?: Record<string, string>) => translate(key, locale, vars);
  const [editingExpenses, setEditingExpenses] = useState(false);
  const [expensesDraft, setExpensesDraft] = useState('');
  const [openDetail, setOpenDetail] = useState<1 | 2 | 3 | null>(null);

  const hasBase = monthlyExpenses > 0;
  const levels: LevelDef[] = hasBase
    ? [
        {
          id: 1,
          emoji: '🛡️',
          nameKey: 'levels.level1',
          goalKey: 'levels.l1Goal',
          bodyKey: 'levels.l1Body',
          color: '#5b93ff',
          target: Math.round(monthlyExpenses * 6 * 100) / 100,
          current: notgroschenBalance,
          alloc: [100, 0, 0],
        },
        {
          id: 2,
          emoji: '💰',
          nameKey: 'levels.level2',
          goalKey: 'levels.l2Goal',
          bodyKey: 'levels.l2Body',
          color: '#f8d03a',
          target: Math.round(monthlyExpenses * 150 * 100) / 100,
          current: portfolioTotalPower,
          alloc: [40, 40, 20],
        },
        {
          id: 3,
          emoji: '🕊️',
          nameKey: 'levels.level3',
          goalKey: 'levels.l3Goal',
          bodyKey: 'levels.l3Body',
          color: '#a855f7',
          target: Math.round(monthlyExpenses * 300 * 100) / 100,
          current: portfolioTotalPower,
          alloc: [0, 50, 50],
        },
      ]
    : [];

  const activeLevel = levels.find((l) => l.current < l.target)?.id ?? 3;

  const saveExpenses = () => {
    const n = parseAmount(expensesDraft);
    if (n <= 0) {
      onInvalid(tr('levels.invalidExpenses'));
      return;
    }
    onSaveMonthlyExpenses(n);
    setEditingExpenses(false);
    setExpensesDraft('');
  };

  const startEdit = () => {
    setExpensesDraft(
      monthlyExpenses > 0 ? String(monthlyExpenses).replace('.', ',') : suggestedExpenses > 0 ? String(suggestedExpenses).replace('.', ',') : '',
    );
    setEditingExpenses(true);
  };

  return (
    <div data-tour="home-levels" style={cardStyle}>
      <div style={labelStyle}>{tr('levels.cardTitle')}</div>
      <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12, lineHeight: 1.5 }}>{tr('levels.intro')}</div>

      {editingExpenses || !hasBase ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 700, marginBottom: 6 }}>{tr('levels.expensesLabel')}</div>
          {!hasBase && (
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 8, lineHeight: 1.5 }}>{tr('levels.needExpenses')}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              inputMode="decimal"
              placeholder={suggestedExpenses > 0 ? String(suggestedExpenses).replace('.', ',') : tr('levels.expensesPh')}
              value={editingExpenses ? expensesDraft : ''}
              onFocus={() => {
                if (!editingExpenses) startEdit();
              }}
              onChange={(e) => {
                if (!editingExpenses) setEditingExpenses(true);
                setExpensesDraft(e.target.value);
              }}
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
              onClick={saveExpenses}
            >
              {tr('levels.apply')}
            </button>
          </div>
          {suggestedExpenses > 0 && (
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginTop: 8,
                cursor: 'pointer',
                fontSize: 12,
                color: '#5b93ff',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
              onClick={() => {
                onSaveMonthlyExpenses(suggestedExpenses);
                setEditingExpenses(false);
              }}
            >
              {tr('levels.expensesSuggested', { amount: fmt(suggestedExpenses) })}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#8b949e' }}>
            {tr('levels.expensesLine', { amount: fmt(monthlyExpenses) })}
            {!isManualExpenses && <span style={{ color: '#6e7681' }}> · {tr('levels.autoBadge')}</span>}
          </span>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 12,
              color: '#5b93ff',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
            onClick={startEdit}
          >
            {tr('levels.change')}
          </button>
        </div>
      )}

      {hasBase &&
        levels.map((lvl, idx) => {
          const pct = lvl.target > 0 ? Math.min(100, (lvl.current / lvl.target) * 100) : 0;
          const reached = lvl.current >= lvl.target;
          const isActive = lvl.id === activeLevel && !reached;
          const detailOpen = openDetail === lvl.id;
          return (
            <div key={lvl.id} style={{ position: 'relative', paddingLeft: 26, paddingBottom: idx < levels.length - 1 ? 18 : 0 }}>
              {idx < levels.length - 1 && (
                <div
                  aria-hidden
                  style={{ position: 'absolute', left: 8, top: 22, bottom: 0, width: 2, background: reached ? lvl.color : awBg.line }}
                />
              )}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 3,
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  border: `2px solid ${reached || isActive ? lvl.color : awBg.line}`,
                  background: reached ? lvl.color : awBg.hole,
                  boxShadow: isActive ? `0 0 10px ${lvl.color}88` : 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: reached || isActive ? '#e6edf3' : '#8b949e' }}>
                  {lvl.emoji} {tr(lvl.nameKey)}
                </span>
                {reached && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#3fb950', border: '1px solid #3fb95055', borderRadius: 6, padding: '2px 6px' }}>
                    {tr('levels.reached')}
                  </span>
                )}
                {isActive && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: lvl.color, border: `1px solid ${lvl.color}66`, borderRadius: 6, padding: '2px 6px' }}>
                    {tr('levels.active')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#7d8590', marginTop: 3 }}>{tr(lvl.goalKey)}</div>
              <div style={{ marginTop: 6 }}>
                <div style={{ background: '#1c1c24', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: lvl.color, borderRadius: 99, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
                  {fmt(Math.min(lvl.current, lvl.target))} / {fmt(lvl.target)}
                  {!reached && <span style={{ color: '#6e7681' }}> · {tr('levels.toGo', { amount: fmt(Math.max(0, lvl.target - lvl.current)) })}</span>}
                </div>
              </div>
              <button
                type="button"
                aria-expanded={detailOpen}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  marginTop: 6,
                  cursor: 'pointer',
                  fontSize: 11,
                  color: '#5b93ff',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
                onClick={() => setOpenDetail(detailOpen ? null : lvl.id)}
              >
                {detailOpen ? tr('levels.detailsHide') : tr('levels.detailsShow')}
              </button>
              {detailOpen && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#c9d1d9', lineHeight: 1.55 }}>
                  {tr(lvl.bodyKey, {
                    target: fmt(lvl.target),
                    min: fmt(Math.round(monthlyExpenses * 3 * 100) / 100),
                  })}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 700, marginBottom: 4 }}>{tr('levels.alloc')}</div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#1c1c24' }}>
                      {lvl.alloc[0] > 0 && <div style={{ width: `${lvl.alloc[0]}%`, background: '#3fb950' }} />}
                      {lvl.alloc[1] > 0 && <div style={{ width: `${lvl.alloc[1]}%`, background: '#f8d03a' }} />}
                      {lvl.alloc[2] > 0 && <div style={{ width: `${lvl.alloc[2]}%`, background: '#f0883e' }} />}
                    </div>
                    <div style={{ fontSize: 10, color: '#6e7681', marginTop: 4 }}>
                      {lvl.alloc[0] > 0 && `${lvl.alloc[0]} % ${tr('levels.allocLow')}  `}
                      {lvl.alloc[1] > 0 && `${lvl.alloc[1]} % ${tr('levels.allocMid')}  `}
                      {lvl.alloc[2] > 0 && `${lvl.alloc[2]} % ${tr('levels.allocHigh')}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
