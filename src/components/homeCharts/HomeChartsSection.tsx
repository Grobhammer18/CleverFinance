import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';
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
import DebtPaydownCurve from './DebtPaydownCurve';
import { resolveHomeChartSeries, type PieSlice, type ChartTx, type ChartDebt, type ChartPortfolioTrade, type WealthLinePt, type DailyVermogenSnapshot } from './homeChartData';

const EUR_FMT = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const PIE_PALETTE = ['#00d4aa', '#2563eb', '#a855f7', '#f8d03a', '#ff7b7b', '#5b93ff', '#f0883e', '#7c3aed'];

const MONTH_SHORT_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

type MoneyMonthBucket = { einnahmen: number; ausgaben: number };

const cardStyle: CSSProperties = {
  padding: '16px',
  borderRadius: 14,
  background: aw.card,
  border: `1px solid ${aw.cardBorder}`,
  boxShadow: '0 14px 30px rgba(0, 0, 0, 0.39)',
};

/** Jahres‑Balken aus Money — zuvor auf Home, nun Tab Übersicht. */
function YearMoneyOverviewCard(props: {
  reportYear: number;
  buckets: MoneyMonthBucket[];
  levelUpLocked: boolean;
  formatMoney: (n: number) => string;
}) {
  const nets = props.buckets.map((m) => Math.abs(m.einnahmen - m.ausgaben));
  const maxAbs = Math.max(1, ...nets);
  const yearSum = props.buckets.reduce((s, m) => s + m.einnahmen - m.ausgaben, 0);
  const wrapStyle: CSSProperties = props.levelUpLocked
    ? cardStyle
    : { ...cardStyle, marginBottom: 22, border: '1px solid #7c3aed44' };

  return (
    <div style={wrapStyle}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#e6edf3', marginBottom: 8 }}>🗓️ Jahr {props.reportYear}</div>
        {!props.levelUpLocked ? (
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, lineHeight: 1.45 }}>
            Jahresübersicht aus Money (Einnahmen − Ausgaben pro Monat) — <span style={{ color: '#a855f7', fontWeight: 600 }}>über</span> deinem Portfolio.
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, lineHeight: 1.45 }}>
            Aus Money: Monats-Saldo (Einnahmen − Ausgaben). Portfolio weiter unten unter „Portfolio Power + Cash“, sobald LevelUp frei ist.
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
                  title={`${MONTH_SHORT_DE[i]}: ${props.formatMoney(net)}`}
                />
                <div style={{ fontSize: 8, color: '#8b949e' }}>{MONTH_SHORT_DE[i]}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#2563eb' }}>▮ Plus</span>
            <span style={{ fontSize: 11, color: '#ff7b7b' }}>▮ Minus</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>Jahres-Score: {props.formatMoney(yearSum)}</span>
        </div>
      </div>
    </div>
  );
}

const chartMargins = { top: 6, right: 8, bottom: 0, left: 0 };

type Props = {
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
};

/** Eine Linie im Chart; Tooltip: Schulden-Zeile nur, wenn dieser Stichtag noch Restschuld hatte. */
function WealthKomplettTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { payload?: WealthLinePt }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const rowBg = '#161b22';
  const hadDebtHere = row.schulden > 0.5;
  const hadImmoHere = row.immobilienWert > 0.5;
  const lineSub: Array<[string, number, string]> = [
    ['Notgroschen', row.notgroschen, '#5b93ff'],
    ['Portfolio inkl. Cash', row.portfolioPlusCash, '#a855f7'],
  ];
  if (hadImmoHere) lineSub.push(['Immobilien (Marktwert)', row.immobilienWert, '#2563eb']);
  if (hadDebtHere) lineSub.push(['Schulden (Rest)', row.schulden, '#f0883e']);
  return (
    <div
      style={{
        background: rowBg,
        border: `1px solid ${aw.line}`,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        color: '#e6edf3',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        minWidth: 220,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8, color: '#c9d1d9' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${aw.line}` }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#00d4aa', flexShrink: 0 }} />
        <span style={{ color: '#8b949e' }}>
          {hadImmoHere
            ? 'Gesamt (NG + Portfolio + Immobilien − Schulden):'
            : hadDebtHere
              ? 'Gesamt (NG + Portfolio − Schulden):'
              : 'Gesamt (Notgroschen + Portfolio):'}
        </span>{' '}
        <strong style={{ color: '#00d4aa' }}>{EUR_FMT.format(row.saldoKomplett)}</strong>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#7d8590', marginBottom: 6 }}>Einzelteil zum Stichtag</div>
      {lineSub.map(([title, val, col]) => (
        <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: col, flexShrink: 0 }} />
          <span style={{ color: '#8b949e', flex: '1 1 auto' }}>{title}</span>
          <strong>{EUR_FMT.format(typeof val === 'number' ? val : 0)}</strong>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: PieSlice & { pct?: number } }[] }) {
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
        {EUR_FMT.format(p.value)} · ca. {pct.toFixed(0)} %
      </div>
    </div>
  );
}

function PieBlock({ title, subtitle, slices }: { title: string; subtitle: string; slices: PieSlice[] }) {
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
        <div style={{ fontSize: 12, color: '#8b949e', padding: '24px 0', textAlign: 'center' as const }}>Noch keine Daten — Buchungen unter Money ergänzen.</div>
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
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function HomeChartsSection(props: Props) {
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
  const [open, setOpen] = useState(true);

  /** reduzierte X-Ticks bei langen Reihen */
  const tickEvery = wealthLen > (isDailySnapshotSeries ? 28 : 14) ? Math.ceil(wealthLen / (isDailySnapshotSeries ? 12 : 10)) : 1;
  const xTicks = useMemo(() => wealth.filter((_, i) => i % tickEvery === 0).map((w) => w.label), [wealth, tickEvery]);

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
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f8d03a', letterSpacing: '0.06em', marginBottom: 4 }}>ÜBERSICHT</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e6edf3' }}>📈 Diagramme &amp; Verlauf</div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 10, lineHeight: 1.5 }}>
            {isDailySnapshotSeries ? (
              <>
                <strong style={{ color: '#c9d1d9' }}>Täglicher Verlauf:</strong> ein Eintrag pro Kalendertag mit Live-Stand (Portfolio inkl. Kurse, Notgroschen, Schulden) — bis zu {spanCount} Tage.
                Ohne History nutzen wir die Monatsrekonstruktion aus Buchungen.
              </>
            ) : (
              <>
                Monatsverlauf aus Buchungen &amp; Orders rekonstruiert (max. {spanCount} Monate). Positionswerte mit <strong style={{ color: '#c9d1d9' }}>heutigem</strong>{' '}
                Kurs simuliert — bei manuellen Ständen ohne Buchung können Abweichungen entstehen. Mit mindestens zwei Tages-Snapshots erscheint hier die tägliche Kurve.
              </>
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
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f8d03a', letterSpacing: '0.06em', marginBottom: 4 }}>ÜBERSICHT</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e6edf3' }}>📈 Diagramme &amp; Verlauf</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6, lineHeight: 1.45 }}>
                {isDailySnapshotSeries ? (
                  <>
                    Tägliche Einträge mit Live-Portfolio (max. {spanCount} Tage). Sonst Monatsrekonstruktion aus Buchungen.
                  </>
                ) : (
                  <>
                    Monatsverlauf aus Buchungen &amp; Orders rekonstruiert (max. {spanCount} Monate). Positionswerte mit <strong style={{ color: '#c9d1d9' }}>heutigem</strong> Kurs simuliert. Ab
                    zwei Tagen mit gespeicherter Übersicht: tägliche Kurve.
                  </>
                )}
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
              reportYear={props.moneyYearOverview.reportYear}
              buckets={props.moneyYearOverview.buckets}
              levelUpLocked={props.moneyYearOverview.levelUpLocked}
              formatMoney={props.moneyYearOverview.formatMoney}
            />
          ) : null}
          <ChartBlock
            title="Komplette Vermögensübersicht"
            subtitle={
              isDailySnapshotSeries
                ? 'Eine Linie: Notgroschen + Portfolio + Immobilien (Marktwert aus Boost) − Schulden pro Tag. Tooltip: Detail je Stichtag.'
                : 'Eine Linie: Notgroschen + Portfolio + Immobilien (Marktwert Hauskredit in Boost) − Schulden. Monat anfahren für Einzelteile; ab 2 Tages-Snapshots tägliche Kurve.'
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={wealth} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 10 }} ticks={xTicks} interval={0} />
                <YAxis
                  tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  width={36}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<WealthKomplettTooltip />} />
                <Legend wrapperStyle={{ color: '#c9d1d9', fontSize: 11, paddingTop: 8 }} />
                <Line
                  type="monotone"
                  dot={false}
                  strokeWidth={3}
                  activeDot={{ r: 5 }}
                  name="NG + Portfolio + Immobilien − Schulden"
                  dataKey="saldoKomplett"
                  stroke="#00d4aa"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBlock>

          <ChartBlock
            title="Portfolio Power + Cash"
            subtitle={
              isDailySnapshotSeries
                ? 'Portfolio inkl. Cash Depot zum Tages-Stichtag (wie unter „Komplette Vermögensübersicht“ gespeichert).'
                : 'Investierter Wert (heutige Kurse) plus Cash Depot zum Monatsende.'
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
                  formatter={(value: number) => [EUR_FMT.format(Number(value)), 'Portfolio + Cash']}
                  labelStyle={{ color: '#c9d1d9' }}
                  contentStyle={{ background: '#161b22', border: `1px solid ${aw.line}`, borderRadius: 8 }}
                />
                <Line {...lineCommon} dataKey="value" name="EUR" stroke="#a855f7" />
              </LineChart>
            </ResponsiveContainer>
          </ChartBlock>

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
              title="Einnahmen nach Kategorie"
              subtitle="Summe der letzten Beträge je Position (Gehalt, Trinkgeld, Dividende, …) — gruppiert nach Kategorie, wie unter Money."
              slices={props.incomePie}
            />
            <PieBlock
              title="Fixkosten (letzte Beträge je Position)"
              subtitle="Aus Abos, Miete und Kreditrate — gleiche Logik wie unter Money."
              slices={props.fixedPie}
            />
            <PieBlock
              title="Variable Kosten (letzte Beträge je Position)"
              subtitle="Essen &amp; Trinken, Fahrt, Kleidung, Gesundheit, Freizeit, Sonstiges — je Kategorie + Notiz."
              slices={props.varPie}
            />
          </div>

          {hasOpenDebts ? (
            <ChartBlock
              title="Schulden‑Entwicklung"
              subtitle="Links die Geld‑Achse (Restschuld in €), unten die Zeit‑Richtung von „Start“ (Summe Ursprungsbeträge) bis „jetzt“ (aktueller Rest). Höhe der Kurve = Schuldenbetrag."
            >
              {paydownOriginal > 0 ? (
                <>
                  <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
                    Fläche unter der Kurve: warmer Verlauf Richtung Tilgung. Endpunkt rechts entspricht deinem Rest heute.
                  </div>
                  <DebtPaydownCurve original={paydownOriginal} remaining={paydownRemaining} />
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#8b949e', paddingBottom: 4 }}>
                  Lege unter Boost bei jeder offenen Schuld einen Gesamtbetrag fest — dann zeigt sich die Kurve.
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
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e6edf3', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 12, lineHeight: 1.45 }}>{subtitle}</div>
      {children}
    </div>
  );
}
