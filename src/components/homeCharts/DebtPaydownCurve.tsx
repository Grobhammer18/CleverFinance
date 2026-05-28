import { useId } from 'react';

const axisEurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function compactEur(n: number): string {
  const a = Math.abs(n);
  if (a >= 10_000) return `${Math.round(n / 1000)} k €`;
  return axisEurFmt.format(Math.round(n));
}

/** Kurve: Schuldenhöhe fällt; Fläche mit Orange→Grün-Verlauf + feiner Schraffur. Mit Geld‑ (links) und Zeit‑Achsenbeschriftung (unten). */
export default function DebtPaydownCurve({ original, remaining }: { original: number; remaining: number }) {
  const idSafe = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gidArea = `allwinDebtAreaGrad-${idSafe}`;
  const gidHatch = `allwinDebtHatch-${idSafe}`;
  const gidStroke = `allwinDebtCurveStroke-${idSafe}`;

  if (original <= 0) return null;
  const w = 360;
  const h = 154;
  const pt = 16;
  const pb = 40;
  const pl = 56;
  const pr = 12;
  const cw = w - pl - pr;
  const ch = h - pt - pb;
  const rem = Math.max(0, Math.min(remaining, original));
  const yAt = (debt: number) => pt + (1 - debt / original) * ch;
  const x0 = pl;
  const x1 = pl + cw;
  const y0 = yAt(original);
  const y1 = yAt(rem);
  const curve = `M ${x0} ${y0} C ${pl + cw * 0.3} ${y0 + ch * 0.14}, ${pl + cw * 0.7} ${y1 - ch * 0.08}, ${x1} ${y1}`;
  const baselineY = h - pb;
  const areaD = `${curve} L ${x1} ${baselineY} L ${x0} ${baselineY} Z`;

  const yMid = yAt(original * 0.5);
  const yBot = baselineY;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxHeight: 176, display: 'block', marginBottom: 8 }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gidArea} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x1} y2={0}>
          <stop offset="0%" stopColor="#c45d1a" stopOpacity="0.62" />
          <stop offset="55%" stopColor="#f0883e" stopOpacity="0.5" />
          <stop offset="92%" stopColor="#4d7ae8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.72" />
        </linearGradient>
        <pattern id={gidHatch} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(42)">
          <rect width="7" height="7" fill="none" />
          <path d="M0,7 L7,0" stroke="#08080c" strokeWidth="1.15" strokeOpacity="0.22" />
          <path d="M0,0 L7,7" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.06" />
        </pattern>
        <linearGradient id={gidStroke} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ffb47a" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>

      {/* Y-Achse (Geld) */}
      <line x1={pl} y1={pt} x2={pl} y2={baselineY} stroke="#484f58" strokeWidth="1.2" />
      <text transform={`translate(12 ${pt + ch * 0.52}) rotate(-90)`} fontSize={10} fill="#8b949e" textAnchor="middle">
        Geld (€)
      </text>
      <text x={pl - 6} y={y0 + 4} fontSize={9} fill="#aeb8c4" textAnchor="end">
        {compactEur(original)}
      </text>
      <text x={pl - 6} y={yMid + 4} fontSize={9} fill="#8b949e" textAnchor="end">
        {compactEur(original * 0.5)}
      </text>
      <text x={pl - 6} y={yBot} fontSize={9} fill="#8b949e" textAnchor="end" dominantBaseline="middle">
        {compactEur(0)}
      </text>
      <line x1={pl - 4} y1={y0} x2={pl} y2={y0} stroke="#484f58" strokeWidth={1} />
      <line x1={pl - 4} y1={yMid} x2={pl} y2={yMid} stroke="#30363d" strokeWidth={1} />
      <line x1={pl - 4} y1={yBot} x2={pl} y2={yBot} stroke="#484f58" strokeWidth={1} />

      {/* X-Achse / Zeit */}
      <line x1={pl} y1={baselineY} x2={w - pr} y2={baselineY} stroke="#484f58" strokeWidth="1.2" />

      <path d={areaD} fill={`url(#${gidArea})`} />
      <path d={areaD} fill={`url(#${gidHatch})`} />
      <path d={curve} fill="none" stroke={`url(#${gidStroke})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x0} cy={y0} r="3.5" fill="#ffb47a" />
      <circle cx={x1} cy={y1} r="4" fill="#93c5fd" stroke="#08080c" strokeWidth="1.5" />

      <text x={(x0 + x1) * 0.5} y={baselineY + 12} fontSize={10} fill="#8b949e" textAnchor="middle">
        Zeit →
      </text>
      <text x={x0} y={baselineY + 26} fontSize={9} fill="#7d8590" textAnchor="middle">
        Start (Ursprung)
      </text>
      <text x={x1} y={baselineY + 26} fontSize={9} fill="#7d8590" textAnchor="middle">
        jetzt
      </text>
    </svg>
  );
}
