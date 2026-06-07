import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { allwinPalette as aw } from '../../theme/allwinPalette';
import type { AppLocale } from '../../i18n/locale';
import { monthLabel, t as translate } from '../../i18n/messages';
import DebtPaydownCurve from './DebtPaydownCurve';
import {
  resolveHomeChartSeries,
  saldoKomplettFromParts,
  type PieSlice,
  type ChartTx,
  type ChartDebt,
  type ChartPortfolioTrade,
  type WealthLinePt,
  type DailyVermogenSnapshot,
} from './homeChartData';


const PIE_PALETTE = ['#00d4aa', '#2563eb', '#a855f7', '#f8d03a', '#ff7b7b', '#5b93ff', '#f0883e', '#7c3aed'];

type MoneyMonthBucket = { einnahmen: number; ausgaben: number };

function cs(locale: AppLocale, key: string, vars?: Record<string, string>) {
  return translate(`chartsSection.${key}`, locale, vars);
}

const cardStyle: CSSProperties = {
  padding: '16px',
  borderRadius: 14,
  background: aw.card,
  border: `1px solid ${aw.cardBorder}`,
  boxShadow: '0 14px 30px rgba(0, 0, 0, 0.39)',
};

/** Jahres‑Balken aus Money — zuvor auf Home, nun Tab Übersicht. */
function YearMoneyOverviewCard(props: {
  locale: AppLocale;
  reportYear: number;
  buckets: MoneyMonthBucket[];
  levelUpLocked: boolean;
  formatMoney: (n: number) => string;
}) {
  const nets = props.buckets.map((m) => Math.abs(m.einnahmen - m.ausgaben));
  const maxAbs = Math.max(1, ...nets);
  const yearSum = props.buckets.reduce((s, m) => s + m.einnahmen - m.ausgaben, 0);
  const wrapStyle: CSSProperties = {
    ...cardStyle,
    marginBottom: 24,
    ...(!props.levelUpLocked ? { border: '1px solid #7c3aed44' } : {}),
  };

  return (
    <div style={wrapStyle}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#e6edf3', marginBottom: 8 }}>{cs(props.locale, 'yearTitle', { year: String(props.reportYear) })}</div>
        {!props.levelUpLocked ? (
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, lineHeight: 1.45 }}>
            {cs(props.locale, 'yearSubtitleUnlocked')}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, lineHeight: 1.45 }}>
            {cs(props.locale, 'yearSubtitleLocked')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
          {props.buckets.map((m, i) => {
            const net = m.einnahmen - m.ausgaben;
            const pos = net >= 0;
            const h = Math.abs(net);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div
                  style={{
                    width: '100%',
                    height: Math.max(4, (h / maxAbs) * 50),
                    background: pos ? '#2563eb' : '#ff7b7b',
                    borderRadius: 3,
                  }}
                  title={`${monthLabel(i, props.locale)}: ${props.formatMoney(net)}`}
                />
                <div style={{ fontSize: 8, color: '#8b949e' }}>{monthLabel(i, props.locale)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#2563eb' }}>{cs(props.locale, 'plusLegend')}</span>
            <span style={{ fontSize: 11, color: '#ff7b7b' }}>{cs(props.locale, 'minusLegend')}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>{cs(props.locale, 'yearScore', { amount: props.formatMoney(yearSum) })}</span>
        </div>
      </div>
    </div>
  );
}

const chartMargins = { top: 6, right: 8, bottom: 0, left: 0 };
const wealthChartMargins = { top: 12, right: 8, bottom: 4, left: 0 };

type Props = {
  locale: AppLocale;
  formatMoney: (n: number) => string;
  transactions: ChartTx[];
  debts: ChartDebt[];
  notgroschenBalance: number;
  portfolioBrokerCash: number;
  portfolioTrades: ChartPortfolioTrade[];
  marketPrices: Record<string, number>;
  fixedPie: PieSlice[];
  varPie: PieSlice[];
  incomePie: PieSlice[];
  dailyVermogenSnapshots: DailyVermogenSnapshot[];
  /** Tab Übersicht: Jahresbalken (Money) — optional für eingebettete Übersicht. */
  moneyYearOverview?: {
    reportYear: number;
    buckets: MoneyMonthBucket[];
    levelUpLocked: boolean;
    formatMoney: (n: number) => string;
  };
  /** Eigene Navigation-Seite: kein Aufklappen, Heading oben fest. */
  standalonePage?: boolean;
  /** LevelUp gesperrt (Schulden/Notgroschen): kein Portfolio-Chart, Vermögenslinie ohne Portfolio. */
  levelUpLocked?: boolean;
};

/** Detailkarte unter dem Chart — blockiert keine weiteren Klicks auf die Linie. */
function WealthDetailPanel({
  row,
  locale,
  formatMoney,
  onClose,
}: {
  row: WealthLinePt;
  locale: AppLocale;
  formatMoney: (n: number) => string;
  onClose: () => void;
}) {
  const hadDebtHere = row.schulden > 0.5;
  const hadImmoHere = row.immobilienWert > 0.5;
  const hadPortfolioHere = row.portfolioPlusCash > 0.5;
  const lineSub: Array<[string, number, string]> = [[cs(locale, 'emergencyFund'), row.notgroschen, '#5b93ff']];
  if (hadPortfolioHere) lineSub.push([cs(locale, 'portfolioInclCash'), row.portfolioPlusCash, '#a855f7']);
  if (hadImmoHere) lineSub.push([cs(locale, 'propertyMarketValue'), row.immobilienWert, '#2563eb']);
  if (hadDebtHere) lineSub.push([cs(locale, 'debtsRemaining'), row.schulden, '#f0883e']);
  const totalLabel = hadPortfolioHere
    ? hadImmoHere
      ? cs(locale, 'totalNgPortfolioImmoDebt')
      : hadDebtHere
        ? cs(locale, 'totalNgPortfolioDebt')
        : cs(locale, 'totalNgPortfolio')
    : hadImmoHere
      ? cs(locale, 'totalNgImmoDebt')
      : hadDebtHere
        ? cs(locale, 'totalNgDebt')
        : cs(locale, 'totalNg');
  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${aw.line}`,
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 12,
        color: '#e6edf3',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: '#c9d1d9' }}>{row.label}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label={cs(locale, 'closeDetails')}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 2px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${aw.line}` }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#00d4aa', flexShrink: 0 }} />
        <span style={{ color: '#8b949e' }}>{totalLabel}</span>{' '}
        <strong style={{ color: '#00d4aa' }}>{formatMoney(row.saldoKomplett)}</strong>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#7d8590', marginBottom: 6 }}>{cs(locale, 'componentsAtDate')}</div>
      {lineSub.map(([title, val, col]) => (
        <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
          <span style={{ color: '#8b949e', flex: '1 1 auto' }}>{title}</span>
          <strong>{formatMoney(typeof val === 'number' ? val : 0)}</strong>
        </div>
      ))}
    </div>
  );
}

function normalizeWealthRow(row: WealthLinePt): WealthLinePt {
  const immo = row.immobilienWert ?? 0;
  const ng = row.notgroschen ?? 0;
  const port = row.portfolioPlusCash ?? 0;
  const sch = row.schulden ?? 0;
  return {
    ...row,
    notgroschen: ng,
    portfolioPlusCash: port,
    immobilienWert: immo,
    schulden: sch,
    saldoKomplett: row.saldoKomplett ?? saldoKomplettFromParts(ng, port, sch, immo),
  };
}

type WealthChartClickState = {
  activePayload?: ReadonlyArray<{ payload?: WealthLinePt }>;
  activeTooltipIndex?: number;
  activeLabel?: string;
};

function PieTooltip({
  active,
  payload,
  locale,
  formatMoney,
}: {
  active?: boolean;
  payload?: readonly { payload?: PieSlice & { pct?: number } }[];
  locale: AppLocale;
  formatMoney: (n: number) => string;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const p = payload[0].payload;
  const pct = p.pct ?? 0;
  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${aw.line}`,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        color: '#e6edf3',
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 800 }}>{p.name}</div>
      <div style={{ marginTop: 4, color: '#8b949e' }}>
        {cs(locale, 'pieTooltip', { amount: formatMoney(p.value), pct: pct.toFixed(0) })}
      </div>
    </div>
  );
}

function PieBlock({
  title,
  subtitle,
  slices,
  locale,
  formatMoney,
}: {
  title: string;
  subtitle: string;
  slices: PieSlice[];
  locale: AppLocale;
  formatMoney: (n: number) => string;
}) {
  const withPct = useMemo(() => {
    const sum = slices.reduce((s, x) => s + x.value, 0);
    if (sum <= 0) return [] as Array<PieSlice & { pct: number; key: string }>;
    return slices.map((sl, idx) => ({ ...sl, pct: (sl.value / sum) * 100, key: `${sl.name}-${idx}` }));
  }, [slices]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#c9d1d9', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 10, lineHeight: 1.45 }}>{subtitle}</div>
      {withPct.length === 0 ? (
        <div style={{ fontSize: 12, color: '#8b949e', padding: '24px 0', textAlign: 'center' as const }}>{cs(locale, 'pieNoData')}</div>
      ) : (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <Pie
                data={withPct}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={1}
                stroke={aw.cardBorder}
                strokeWidth={1}
              >
                {withPct.map((entry, i) => (
                  <Cell key={entry.key} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip locale={locale} formatMoney={formatMoney} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function HomeChartsSection(props: Props) {
  const { locale, formatMoney } = props;
  const { wealth, portfolioOnly, spanCount, isDailySnapshotSeries } = useMemo(
    () =>
      resolveHomeChartSeries(
        props.transactions,
        props.debts,
        props.notgroschenBalance,
        props.portfolioBrokerCash,
        props.portfolioTrades,
        props.marketPrices,
        props.dailyVermogenSnapshots,
      ),
    [
      props.transactions,
      props.debts,
      props.notgroschenBalance,
      props.portfolioBrokerCash,
      props.portfolioTrades,
      props.marketPrices,
      props.dailyVermogenSnapshots,
    ],
  );

  const wealthLen = wealth.length;
  const standalone = props.standalonePage ?? false;
  const levelUpLocked = props.levelUpLocked ?? props.moneyYearOverview?.levelUpLocked ?? false;
  const [wealthDetail, setWealthDetail] = useState<WealthLinePt | null>(null);
  const wealthDetailRef = useRef<HTMLDivElement>(null);
  const wealthDisplay = useMemo((): WealthLinePt[] => {
    if (!levelUpLocked) return wealth;
    return wealth.map((w) => ({
      ...w,
      portfolioPlusCash: 0,
      saldoKomplett: saldoKomplettFromParts(w.notgroschen, 0, w.schulden, w.immobilienWert ?? 0),
    }));
  }, [wealth, levelUpLocked]);

  const wealthDataSignature = useMemo(() => wealthDisplay.map((w) => w.ym).join('|'), [wealthDisplay]);

  useEffect(() => {
    setWealthDetail(null);
  }, [wealthDataSignature]);

  useEffect(() => {
    if (!wealthDetail || !wealthDetailRef.current) return;
    const t = window.setTimeout(() => {
      wealthDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [wealthDetail]);

  const selectWealthRow = useCallback((row: WealthLinePt | null | undefined) => {
    if (row) setWealthDetail(normalizeWealthRow(row));
  }, []);

  const pickWealthPoint = useCallback(
    (state: WealthChartClickState | null | undefined) => {
      if (!state) return;
      let row = state.activePayload?.[0]?.payload;
      if (!row && typeof state.activeTooltipIndex === 'number') {
        row = wealthDisplay[state.activeTooltipIndex];
      }
      if (!row && state.activeLabel) {
        row = wealthDisplay.find((w) => w.label === state.activeLabel);
      }
      selectWealthRow(row);
    },
    [wealthDisplay, selectWealthRow],
  );

  const [open, setOpen] = useState(true);

  /** reduzierte X-Ticks bei langen Reihen */
  const tickEvery = wealthLen > (isDailySnapshotSeries ? 28 : 14) ? Math.ceil(wealthLen / (isDailySnapshotSeries ? 12 : 10)) : 1;
  const xTicks = useMemo(() => wealthDisplay.filter((_, i) => i % tickEvery === 0).map((w) => w.label), [wealthDisplay, tickEvery]);

  const lineCommon = {
    type: 'monotone' as const,
    dot: false,
    strokeWidth: 2,
    activeDot: { r: 4 },
  };

  const expanded = standalone || open;
  const hasOpenDebts = props.debts.some((d) => d.remaining > 1e-9);
  const { paydownOriginal, paydownRemaining } = useMemo(() => {
    const active = props.debts.filter((d) => d.remaining > 1e-9);
    return {
      paydownOriginal: active.reduce((s, d) => s + Math.max(0, d.total), 0),
      paydownRemaining: active.reduce((s, d) => s + d.remaining, 0),
    };
  }, [props.debts]);

  return (
    <div style={{ ...cardStyle, marginTop: standalone ? 0 : 12 }}>
      {standalone ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f8d03a', letterSpacing: '0.06em', marginBottom: 4 }}>{cs(locale, 'overviewLabel')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e6edf3' }}>{cs(locale, 'title')}</div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 10, lineHeight: 1.5 }}>
            {isDailySnapshotSeries ? (
              <>
                <strong style={{ color: '#c9d1d9' }}>{cs(locale, 'standaloneDailyLead')}</strong>{' '}
                {cs(locale, 'standaloneDailyBody', { count: String(spanCount) })}
              </>
            ) : (
              cs(locale, 'standaloneMonthlyBody', { count: String(spanCount) })
            )}
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left' as const,
            }}
            aria-expanded={open}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f8d03a', letterSpacing: '0.06em', marginBottom: 4 }}>{cs(locale, 'overviewLabel')}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e6edf3' }}>{cs(locale, 'title')}</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6, lineHeight: 1.45 }}>
                {isDailySnapshotSeries
                  ? cs(locale, 'collapsedDaily', { count: String(spanCount) })
                  : cs(locale, 'collapsedMonthly', { count: String(spanCount) })}
              </div>
            </div>
            <span style={{ fontSize: 14, color: '#8b949e', fontWeight: 800, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
          </button>
        </>
      )}

      {expanded && (
        <div style={{ marginTop: standalone ? 4 : 16 }}>
          {standalone && props.moneyYearOverview ? (
            <YearMoneyOverviewCard
              locale={locale}
              reportYear={props.moneyYearOverview.reportYear}
              buckets={props.moneyYearOverview.buckets}
              levelUpLocked={props.moneyYearOverview.levelUpLocked}
              formatMoney={props.moneyYearOverview.formatMoney}
            />
          ) : null}
          <ChartBlock
            topSpacing={standalone && props.moneyYearOverview ? 4 : 0}
            title={cs(locale, 'wealthTitle')}
            subtitle={
              levelUpLocked
                ? isDailySnapshotSeries
                  ? cs(locale, 'wealthSubtitleLockedDaily')
                  : cs(locale, 'wealthSubtitleLockedMonthly')
                : isDailySnapshotSeries
                  ? cs(locale, 'wealthSubtitleDaily')
                  : cs(locale, 'wealthSubtitleMonthly')
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={wealthDisplay}
                margin={wealthChartMargins}
                onClick={(state) => pickWealthPoint(state as WealthChartClickState)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 10 }} ticks={xTicks} interval={0} />
                <YAxis
                  tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  width={36}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={() => null} cursor={{ stroke: '#484f58', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend wrapperStyle={{ color: '#c9d1d9', fontSize: 11, paddingTop: 8 }} />
                <Line
                  type="monotone"
                  isAnimationActive={false}
                  dot={(dotProps: { cx?: number; cy?: number; payload?: WealthLinePt; index?: number }) => {
                    const { cx, cy, payload, index } = dotProps;
                    if (cx == null || cy == null) return null;
                    const row = payload ?? (typeof index === 'number' ? wealthDisplay[index] : undefined);
                    const pick = () => selectWealthRow(row);
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={18}
                          fill="transparent"
                          style={{ cursor: 'pointer', touchAction: 'manipulation' }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            pick();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            pick();
                          }}
                        />
                        <circle cx={cx} cy={cy} r={5} fill="#0d1117" stroke="#00d4aa" strokeWidth={2} pointerEvents="none" />
                      </g>
                    );
                  }}
                  strokeWidth={3}
                  activeDot={{ r: 7, stroke: '#00d4aa', strokeWidth: 2, fill: '#161b22' }}
                  name={levelUpLocked ? cs(locale, 'legendLocked') : cs(locale, 'legendFull')}
                  dataKey="saldoKomplett"
                  stroke="#00d4aa"
                />
              </LineChart>
            </ResponsiveContainer>
            <div ref={wealthDetailRef} style={{ marginTop: 14 }}>
              {wealthDetail ? (
                <WealthDetailPanel row={wealthDetail} locale={locale} formatMoney={formatMoney} onClose={() => setWealthDetail(null)} />
              ) : (
                <div style={{ fontSize: 11, color: '#6e7681', textAlign: 'center' as const, padding: '6px 0 2px' }}>
                  {cs(locale, 'tapHint')}
                </div>
              )}
            </div>
          </ChartBlock>

          {levelUpLocked ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid #7c3aed44',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#c9d1d9', marginBottom: 6 }}>{cs(locale, 'portfolioLockedTitle')}</div>
              <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.5 }}>
                {cs(locale, 'portfolioLockedBody')}
              </div>
            </div>
          ) : (
            <ChartBlock
              title={cs(locale, 'portfolioTitle')}
              subtitle={
                isDailySnapshotSeries ? cs(locale, 'portfolioSubtitleDaily') : cs(locale, 'portfolioSubtitleMonthly')
              }
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={portfolioOnly} margin={chartMargins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 10 }} ticks={xTicks} interval={0} />
                  <YAxis
                    tick={{ fill: '#8b949e', fontSize: 10 }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    width={32}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatMoney(Number(value)), cs(locale, 'portfolioTooltip')]}
                    labelStyle={{ color: '#c9d1d9' }}
                    contentStyle={{ background: '#161b22', border: `1px solid ${aw.line}`, borderRadius: 8 }}
                  />
                  <Line {...lineCommon} dataKey="value" name="EUR" stroke="#a855f7" />
                </LineChart>
              </ResponsiveContainer>
            </ChartBlock>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 8,
              marginBottom: 8,
              borderTop: `1px solid ${aw.cardBorder}`,
              paddingTop: 14,
            }}
          >
            <PieBlock
              title={cs(locale, 'incomePieTitle')}
              subtitle={cs(locale, 'incomePieSubtitle')}
              slices={props.incomePie}
              locale={locale}
              formatMoney={formatMoney}
            />
            <PieBlock
              title={cs(locale, 'fixedPieTitle')}
              subtitle={cs(locale, 'fixedPieSubtitle')}
              slices={props.fixedPie}
              locale={locale}
              formatMoney={formatMoney}
            />
            <PieBlock
              title={cs(locale, 'varPieTitle')}
              subtitle={cs(locale, 'varPieSubtitle')}
              slices={props.varPie}
              locale={locale}
              formatMoney={formatMoney}
            />
          </div>

          {hasOpenDebts ? (
            <ChartBlock
              title={cs(locale, 'debtTitle')}
              subtitle={cs(locale, 'debtSubtitle')}
            >
              {paydownOriginal > 0 ? (
                <>
                  <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
                    {cs(locale, 'debtChartHint')}
                  </div>
                  <DebtPaydownCurve original={paydownOriginal} remaining={paydownRemaining} />
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#8b949e', paddingBottom: 4 }}>
                  {cs(locale, 'debtEmpty')}
                </div>
              )}
            </ChartBlock>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ChartBlock({
  title,
  subtitle,
  children,
  topSpacing = 0,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  topSpacing?: number;
}) {
  return (
    <div style={{ marginBottom: 22, marginTop: topSpacing }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e6edf3', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 10, lineHeight: 1.45 }}>{subtitle}</div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
