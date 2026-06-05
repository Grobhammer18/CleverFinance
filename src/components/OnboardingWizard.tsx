import { useMemo, useState } from 'react';
import {
  type FinanceWho,
  type OnboardingV2Payload,
  type WizardDebtRow,
  type InvestDraft,
  computeBranch,
  notgroschenTargetFromIncome,
} from '../onboarding/onboardingLogic';
import { allwinPalette as P } from '../theme/allwinPalette';
import CleverFinanceLogo from './CleverFinanceLogo';

type Step =
  | 'intro'
  | 'finance_who'
  | 'net_income'
  | 'debts_yn'
  | 'debts_types'
  | 'debts_count'
  | 'debts_entries'
  | 'emergency_yn'
  | 'emergency_balance'
  | 'emergency_monthly'
  | 'splash_focus'
  | 'invest_experienced'
  | 'invest_topics'
  | 'invest_amount'
  | 'invest_monthly'
  | 'invest_risk'
  | 'invest_classes_intent'
  | 'invest_classes_held'
  | 'invest_details'
  | 'why_here'
  | 'finish';

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
  },
  card: { background: P.card, borderRadius: 16, padding: 18, marginBottom: 12, border: `1px solid ${P.cardBorder}` },
  logo: { fontSize: 24, fontWeight: 900, letterSpacing: -1, color: '#fff' },
  logoAccent: { color: '#2563eb' },
  label: { fontSize: 11, color: '#7d8590', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6 },
  input: { width: '100%', background: P.field, border: `1px solid ${P.line}`, borderRadius: 10, padding: '10px 14px', color: '#e6edf3', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' },
  btn: (col?: string) => ({
    background: col || '#2563eb',
    color: col ? '#fff' : '#0d1117',
    border: col ? '1px solid #ffffff22' : '1px solid #00f5c233',
    borderRadius: 10,
    padding: '12px 20px',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
    marginTop: 8,
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
  }),
  chip: (active: boolean) => ({
    padding: '10px 14px',
    borderRadius: 99,
    fontSize: 12,
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
    marginTop: 6,
  }),
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mood: { fontSize: 13, color: '#8b949e', lineHeight: 1.45, marginTop: 8, marginBottom: 4 },
  emojiBand: {
    fontSize: 20,
    letterSpacing: 10,
    textAlign: 'center' as const,
    marginTop: 4,
    marginBottom: 8,
    userSelect: 'none' as const,
    opacity: 0.95,
  },
};

function pronoun(who: FinanceWho) {
  if (who === 'partner') return { subj: 'ihr', bes: 'euer', habt: 'habt', verd: 'verdient ihr', euch: 'euch' };
  return { subj: 'du', bes: 'dein', habt: 'hast', verd: 'verdienst du', euch: 'dir' };
}

const TOPICS = ['Aktien', "ETF's / Fonds", 'Immobilien', 'P2P', 'Lebensversicherung', 'Sonstiges'];
const CLASSES_INTENT = ["ETF's", 'Aktien', 'Krypto', 'Anleihen', 'Lebensversicherung', 'Immobilien', 'Sonstiges'];
const CLASSES_HELD = ['Aktien', "ETF's", 'Krypto', 'Anleihen', 'Immobilien', 'P2P', 'Sonstiges'];
const WHY = ['Einfache Übersicht zu haben', 'Die Tools nutzen', 'Alles auf einem Blick haben', 'Mit den Finanzen mehr beschäftigen', 'Sonstiges'];

const WATCHLIST_MAP_OPTS = ['BTC', 'ETH', 'SPY', 'AAPL', 'MSCI'] as const;

/** Während der Eingabe: Ziffern + ein Komma (z. B. „3200,50“). */
function normalizeDecimalInput(raw: string): string {
  let digitsBefore = '';
  let digitsAfter = '';
  let hasSep = false;
  for (const ch of String(raw).replace(/\s/g, '')) {
    if (ch >= '0' && ch <= '9') {
      if (!hasSep) digitsBefore += ch;
      else digitsAfter += ch;
    } else if ((ch === ',' || ch === '.') && !hasSep && digitsBefore.length > 0) {
      hasSep = true;
    }
  }
  return hasSep ? `${digitsBefore},${digitsAfter}` : digitsBefore;
}

function parseNum(raw: string): number {
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

type DebtRowForm = { name: string; totalStr: string; monthlyStr: string; kind: WizardDebtRow['kind'] };
type StockForm = { name: string; buyPriceStr: string; qtyStr: string; mapSym: string };
type ImmoForm = {
  ortPlz: string;
  strasse: string;
  kaufpreisStr: string;
  wohnflaecheStr: string;
  kaltmieteStr: string;
  nebenkostenStr: string;
  letzteErhebung: string;
  zyklusJahre: string;
  mapSym: string;
};
type P2pForm = { gesamtStr: string; profitPctStr: string; mapSym: string };

type Props = { onComplete: (p: OnboardingV2Payload) => void };

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [financeWho, setFinanceWho] = useState<FinanceWho>('alone');
  const [netIncomeStr, setNetIncomeStr] = useState('');
  const [hasDebt, setHasDebt] = useState<boolean | null>(null);
  const [debtKinds, setDebtKinds] = useState({ consumer: false, house: false });
  const [debtCount, setDebtCount] = useState(1);
  const [debtRows, setDebtRows] = useState<DebtRowForm[]>([{ name: '', totalStr: '', monthlyStr: '', kind: 'consumer' }]);
  const [emergencyHas, setEmergencyHas] = useState<boolean | null>(null);
  const [emergencyBalanceStr, setEmergencyBalanceStr] = useState('');
  const [emergencyMonthlyStr, setEmergencyMonthlyStr] = useState('');
  const [splashKind, setSplashKind] = useState<'debt' | 'notgroschen' | null>(null);
  const [investExperienced, setInvestExperienced] = useState<boolean | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicOther, setTopicOther] = useState('');
  const [approxInvStr, setApproxInvStr] = useState('');
  const [monthlyInvStr, setMonthlyInvStr] = useState('');
  const [risk, setRisk] = useState<'' | 'low' | 'mid' | 'high'>('');
  const [classesIntent, setClassesIntent] = useState<string[]>([]);
  const [classesHeld, setClassesHeld] = useState<string[]>([]);
  const [heldOther, setHeldOther] = useState('');
  const [stocks, setStocks] = useState<StockForm[]>([{ name: '', buyPriceStr: '', qtyStr: '', mapSym: '' }]);
  const [cryptos, setCryptos] = useState<StockForm[]>([{ name: '', buyPriceStr: '', qtyStr: '', mapSym: '' }]);
  const [immos, setImmos] = useState<ImmoForm[]>([
    {
      ortPlz: '',
      strasse: '',
      kaufpreisStr: '',
      wohnflaecheStr: '',
      kaltmieteStr: '',
      nebenkostenStr: '',
      letzteErhebung: '',
      zyklusJahre: '',
      mapSym: '',
    },
  ]);
  const [p2p, setP2p] = useState<P2pForm>({ gesamtStr: '', profitPctStr: '', mapSym: '' });
  const [why, setWhy] = useState<string[]>([]);
  const [whyOther, setWhyOther] = useState('');

  const p = useMemo(() => pronoun(financeWho), [financeWho]);
  const netIncome = useMemo(() => parseNum(netIncomeStr), [netIncomeStr]);
  const branch = useMemo(() => {
    const emHas = emergencyHas === true;
    return computeBranch({ hasDebt: hasDebt === true, debtKinds, emergencyHas: emHas });
  }, [hasDebt, debtKinds, emergencyHas]);

  const investSkipped = branch.investSkipped;

  const go = (s: Step) => setStep(s);

  const initDebtRows = (n: number) => {
    const kind0: 'consumer' | 'house' = debtKinds.consumer ? 'consumer' : 'house';
    const rows: DebtRowForm[] = Array.from({ length: n }, (_, i) => ({
      name: i === 0 ? 'Dispokredit' : '',
      totalStr: '',
      monthlyStr: '',
      kind: debtKinds.consumer && !debtKinds.house ? 'consumer' : !debtKinds.consumer && debtKinds.house ? 'house' : i % 2 === 0 ? 'consumer' : 'house',
    }));
    if (rows.length && debtKinds.consumer && !debtKinds.house) rows.forEach((r) => (r.kind = 'consumer'));
    if (rows.length && !debtKinds.consumer && debtKinds.house) rows.forEach((r) => (r.kind = 'house'));
    if (rows.length && debtKinds.consumer && debtKinds.house) rows[0].kind = kind0;
    setDebtRows(rows);
  };

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const buildInvestDraft = (): InvestDraft | null => {
    if (investSkipped) return null;
    return {
      experienced: investExperienced ?? false,
      topics: topics.includes('Sonstiges') && topicOther ? [...topics.filter((t) => t !== 'Sonstiges'), topicOther] : topics,
      approxInvested: parseNum(approxInvStr) || 0,
      monthlyWant: parseNum(monthlyInvStr) || 0,
      risk: risk || 'mid',
      desiredClasses: classesIntent,
      heldClasses: classesHeld.includes('Sonstiges') && heldOther ? [...classesHeld.filter((t) => t !== 'Sonstiges'), heldOther] : classesHeld,
      sonstigesTopic: topicOther,
      stocks: stocks
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name,
          buyPrice: parseNum(s.buyPriceStr) || 0,
          qty: parseNum(s.qtyStr) || 0,
          mapSym: s.mapSym?.trim() || undefined,
        })),
      crypto: cryptos
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name,
          buyPrice: parseNum(s.buyPriceStr) || 0,
          qty: parseNum(s.qtyStr) || 0,
          mapSym: s.mapSym?.trim() || undefined,
        })),
      immo: immos
        .filter((m) => m.ortPlz.trim() || (parseNum(m.kaufpreisStr) || 0) > 0)
        .map((m) => ({
          ortPlz: m.ortPlz,
          strasse: m.strasse,
          kaufpreis: parseNum(m.kaufpreisStr) || 0,
          wohnflaeche: parseNum(m.wohnflaecheStr) || 0,
          kaltmiete: parseNum(m.kaltmieteStr) || 0,
          nebenkosten: parseNum(m.nebenkostenStr) || 0,
          letzteErhebung: m.letzteErhebung,
          zyklusJahre: m.zyklusJahre,
          mapSym: m.mapSym?.trim() || undefined,
        })),
      p2p:
        (parseNum(p2p.gesamtStr) || 0) > 0
          ? [
              {
                gesamt: parseNum(p2p.gesamtStr) || 0,
                profitPct: parseNum(p2p.profitPctStr) || 0,
                mapSym: p2p.mapSym?.trim() || undefined,
              },
            ]
          : [],
    };
  };

  const submitWizard = () => {
    const net = Math.max(0, netIncome);
    const em: OnboardingV2Payload['emergency'] = {
      has: emergencyHas === true,
      balance: emergencyHas ? Math.max(0, parseNum(emergencyBalanceStr) || 0) : 0,
      monthlyContribution: emergencyHas ? 0 : Math.max(0, parseNum(emergencyMonthlyStr) || 0),
    };
    const debts: WizardDebtRow[] = hasDebt
      ? debtRows.map((r) => ({
          name: r.name,
          total: Math.max(0, parseNum(r.totalStr) || 0),
          monthly: Math.max(0, parseNum(r.monthlyStr) || 0),
          kind: r.kind,
        }))
      : [];
    const payload: OnboardingV2Payload = {
      financeWho,
      netIncomeMonthly: net,
      hasDebt: hasDebt === true,
      debtKinds: { ...debtKinds },
      debts,
      emergency: em,
      investSkipped,
      levelUpMode: branch.levelUpMode,
      invest: investSkipped ? null : buildInvestDraft(),
      whyHere: why.includes('Sonstiges') && whyOther.trim() ? [...why.filter((w) => w !== 'Sonstiges'), whyOther.trim()] : why,
    };
    onComplete(payload);
  };

  const nextFromIntro = () => go('finance_who');
  const nextFromFinanceWho = () => go('net_income');
  const nextFromNetIncome = () => {
    if (!Number.isFinite(netIncome) || netIncome <= 0) return;
    go('debts_yn');
  };
  const nextFromDebtsYn = () => {
    if (hasDebt === null) return;
    if (!hasDebt) {
      setDebtKinds({ consumer: false, house: false });
      setDebtRows([]);
      go('emergency_yn');
    } else go('debts_types');
  };
  const nextFromDebtTypes = () => {
    if (!debtKinds.consumer && !debtKinds.house) return;
    go('debts_count');
  };
  const nextFromDebtCount = () => {
    initDebtRows(Math.min(12, Math.max(1, debtCount)));
    go('debts_entries');
  };
  const nextFromDebtEntries = () => {
    for (const r of debtRows) {
      if (!r.name.trim() || (parseNum(r.totalStr) || 0) <= 0) return;
    }
    go('emergency_yn');
  };
  const nextFromEmergencyYn = () => {
    if (emergencyHas === null) return;
    if (emergencyHas) go('emergency_balance');
    else go('emergency_monthly');
  };
  const afterEmergencyBranch = () => {
    const b = computeBranch({
      hasDebt: hasDebt === true,
      debtKinds,
      emergencyHas: emergencyHas === true,
    });
    if (b.investSkipped) {
      if (hasDebt && debtKinds.consumer && !emergencyHas) {
        setSplashKind('debt');
        go('splash_focus');
        return;
      }
      if (hasDebt && debtKinds.house && !emergencyHas) {
        setSplashKind('notgroschen');
        go('splash_focus');
        return;
      }
    }
    go('invest_experienced');
  };

  const nextFromSplash = () => go('why_here');

  const nextFromInvestExperienced = () => {
    if (investExperienced === null) return;
    go('invest_topics');
  };
  const nextFromTopics = () => {
    if (!topics.length) return;
    go('invest_amount');
  };
  const nextFromAmount = () => go('invest_monthly');
  const nextFromMonthly = () => go('invest_risk');
  const nextFromRisk = () => {
    if (!risk) return;
    const a = parseNum(approxInvStr) || 0;
    if (a <= 0) go('invest_classes_intent');
    else go('invest_classes_held');
  };
  const nextFromClassesIntent = () => {
    if (!classesIntent.length) return;
    go('why_here');
  };
  const nextFromClassesHeld = () => {
    if (!classesHeld.length) return;
    go('invest_details');
  };
  const nextFromDetails = () => go('why_here');
  const nextFromWhy = () => {
    if (!why.length) return;
    go('finish');
  };

  const Bar = ({ pct }: { pct: number }) => (
    <div style={{ background: '#1a1f2e', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: '#2563eb', borderRadius: 99 }} />
    </div>
  );

  const stepIndex = useMemo(() => {
    const order: Step[] = [
      'intro',
      'finance_who',
      'net_income',
      'debts_yn',
      'debts_types',
      'debts_count',
      'debts_entries',
      'emergency_yn',
      'emergency_balance',
      'emergency_monthly',
      'splash_focus',
      'invest_experienced',
      'invest_topics',
      'invest_amount',
      'invest_monthly',
      'invest_risk',
      'invest_classes_intent',
      'invest_classes_held',
      'invest_details',
      'why_here',
      'finish',
    ];
    const i = order.indexOf(step);
    return i >= 0 ? i + 1 : 1;
  }, [step]);

  const stepTotal = 19;

  return (
    <div style={W.app}>
      <div style={{ ...W.row, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#7d8590', fontWeight: 700 }}>Clever Finance · Onboarding 😊</div>
        <div style={{ fontSize: 12, color: '#7d8590' }}>ca. 5 Min · easy ✨</div>
      </div>
      <Bar pct={(stepIndex / stepTotal) * 100} />

      <div style={W.card}>
        {step === 'intro' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <CleverFinanceLogo size={118} />
              <div style={W.emojiBand} aria-hidden>
                🤠 ✨ 😊 🚀
              </div>
            </div>
            <div style={{ ...W.logo, textAlign: 'center', marginTop: 4 }}>
              Hey! Schön, dass <span style={W.logoAccent}>{p.subj}</span> hier {p.subj === 'ihr' ? 'seid' : 'bist'}! 🎉
            </div>
            <div style={{ fontSize: 15, color: '#9aa7b5', textAlign: 'center', marginTop: 6, lineHeight: 1.5, fontWeight: 600 }}>
              Deine Finanz-Freiheit — spielerisch, klar, ohne Druck.
            </div>
            <div style={{ fontSize: 14, color: '#c9d1d9', textAlign: 'center', marginTop: 14, lineHeight: 1.55 }}>
              Wir stellen ein paar Fragen, damit Clever Finance zu {p.subj === 'ihr' ? 'euch' : 'dir'} passt — danach zeigen wir dir kurz, wo du was in der App findest.
            </div>
            <button style={W.btn()} onClick={nextFromIntro}>
              Los geht&apos;s — ich bin bereit 💪
            </button>
          </>
        )}

        {step === 'finance_who' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Wie verwaltet {p.subj} die Finanzen? 👋</div>
            <div style={W.mood}>Kleine Auswahl — wir sprechen dich danach einfach richtig an 🙂</div>
            {(
              [
                ['alone', 'Alleine'],
                ['partner', 'Mit Partner:in'],
                ['delegate', 'Partner:in gibt das Geld — ich verwalte es'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" style={W.chip(financeWho === id)} onClick={() => setFinanceWho(id)}>
                <span>{label}</span>
                <span>{financeWho === id ? '✅' : '›'}</span>
              </button>
            ))}
            <button style={W.btn()} onClick={nextFromFinanceWho}>
              Passt — weiter geht&apos;s ✨
            </button>
          </>
        )}

        {step === 'net_income' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? 'Wie viel Netto verdient ihr zusammen? 💶' : 'Wie viel verdienst du netto (monatlich)? 💶'}
            </div>
            <div style={W.mood}>Nur für dein Setup — Daten bleiben bei dir 🔒</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 10 }}>Angabe in € netto pro Monat.</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder="z. B. 3200 oder 3200,50"
              value={netIncomeStr}
              onChange={(e) => setNetIncomeStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={nextFromNetIncome} disabled={!Number.isFinite(netIncome) || netIncome <= 0}>
              Super — weiter 😊
            </button>
          </>
        )}

        {step === 'debts_yn' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? 'Habt ihr Schulden?' : 'Hast du Schulden?'} 🤝
            </div>
            <div style={W.mood}>Ehrlich ist cool — zero Drama, nur bessere Tipps.</div>
            <button type="button" style={W.chip(hasDebt === true)} onClick={() => setHasDebt(true)}>
              <span>Ja</span>
              <span>{hasDebt === true ? '✅' : '›'}</span>
            </button>
            <button type="button" style={W.chip(hasDebt === false)} onClick={() => setHasDebt(false)}>
              <span>Nein</span>
              <span>{hasDebt === false ? '✅' : '›'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromDebtsYn} disabled={hasDebt === null}>
              Weiter
            </button>
          </>
        )}

        {step === 'debts_types' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Was für Schulden? 📒</div>
            <div style={W.mood}>Einfach antippen — mehrfach möglich.</div>
            <button
              type="button"
              style={W.chip(debtKinds.consumer)}
              onClick={() => setDebtKinds((k) => ({ ...k, consumer: !k.consumer }))}
            >
              <span>Dispo / Konsum</span>
              <span>{debtKinds.consumer ? '✅' : '⬜'}</span>
            </button>
            <button type="button" style={W.chip(debtKinds.house)} onClick={() => setDebtKinds((k) => ({ ...k, house: !k.house }))}>
              <span>Hauskredit / Immobilie</span>
              <span>{debtKinds.house ? '✅' : '⬜'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromDebtTypes} disabled={!debtKinds.consumer && !debtKinds.house}>
              Weiter
            </button>
          </>
        )}

        {step === 'debts_count' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Wie viele Kredite / Schulden? 🔢</div>
            <div style={W.mood}>Schätzung reicht — du kannst alles später feinjustieren.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" style={{ ...W.chip(debtCount === n), flex: 1, minWidth: 72, justifyContent: 'center' }} onClick={() => setDebtCount(n)}>
                  {n}
                </button>
              ))}
            </div>
            <input
              style={{ ...W.input, marginTop: 10 }}
              inputMode="numeric"
              placeholder="oder andere Zahl (max. 12)"
              value={String(debtCount)}
              onChange={(e) => setDebtCount(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            />
            <button style={W.btn()} onClick={nextFromDebtCount}>
              Weiter
            </button>
          </>
        )}

        {step === 'debts_entries' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Kreditdetails ✍️</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12 }}>Landet direkt in deinem Schuldentracker — ein kleiner Schritt, große Klarheit.</div>
            {debtRows.map((row, idx) => (
              <div key={idx} style={{ border: `1px solid ${P.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{idx + 1}. Kredit</div>
                <select
                  style={{ ...W.input, marginBottom: 8 }}
                  value={row.kind}
                  onChange={(e) => {
                    const v = e.target.value as 'consumer' | 'house';
                    setDebtRows((prev) => prev.map((r, i) => (i === idx ? { ...r, kind: v } : r)));
                  }}
                >
                  <option value="consumer">Dispo / Konsum</option>
                  <option value="house">Hauskredit</option>
                </select>
                <input
                  style={{ ...W.input, marginBottom: 8 }}
                  placeholder="Name (z. B. Dispokredit)"
                  value={row.name}
                  onChange={(e) => setDebtRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                />
                <input
                  style={{ ...W.input, marginBottom: 8 }}
                  placeholder="Höhe Gesamt (€)"
                  inputMode="decimal"
                  value={row.totalStr}
                  onChange={(e) =>
                    setDebtRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, totalStr: normalizeDecimalInput(e.target.value) } : r)),
                    )
                  }
                />
                <input
                  style={W.input}
                  placeholder="Rate monatlich (€)"
                  inputMode="decimal"
                  value={row.monthlyStr}
                  onChange={(e) =>
                    setDebtRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, monthlyStr: normalizeDecimalInput(e.target.value) } : r)),
                    )
                  }
                />
              </div>
            ))}
            <button style={W.btn()} onClick={nextFromDebtEntries}>
              Weiter
            </button>
          </>
        )}

        {step === 'emergency_yn' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? 'Habt ihr ein Notgroschen?' : 'Hast du ein Notgroschen?'} 🛟
            </div>
            <div style={W.mood}>Polster = Ruhe im Kopf — wir rechnen dir ein sinnvolles Ziel aus.</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12 }}>
              Empfehlung: 2–3 Monatsgehälter als Polster. Zielvorschlag: ca. {fmtEuro(notgroschenTargetFromIncome(netIncome))} (2,5× Netto).
            </div>
            <button type="button" style={W.chip(emergencyHas === true)} onClick={() => setEmergencyHas(true)}>
              <span>Ja</span>
              <span>{emergencyHas === true ? '✅' : '›'}</span>
            </button>
            <button type="button" style={W.chip(emergencyHas === false)} onClick={() => setEmergencyHas(false)}>
              <span>Nein</span>
              <span>{emergencyHas === false ? '✅' : '›'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromEmergencyYn} disabled={emergencyHas === null}>
              Weiter
            </button>
          </>
        )}

        {step === 'emergency_balance' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Wie hoch ist der aktuelle Stand? 💰</div>
            <div style={W.mood}>Nice — du hast schon was liegen! 🙌</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder="€"
              value={emergencyBalanceStr}
              onChange={(e) => setEmergencyBalanceStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={afterEmergencyBranch}>
              Weiter
            </button>
          </>
        )}

        {step === 'emergency_monthly' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              Wie viel möchtet {p.subj === 'ihr' ? 'ihr' : 'du'} monatlich ins Notgroschen legen? 📅
            </div>
            <div style={W.mood}>Jeder Euro zählt — auch kleine Beträge summieren sich.</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder="€ / Monat"
              value={emergencyMonthlyStr}
              onChange={(e) => setEmergencyMonthlyStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={afterEmergencyBranch}>
              Weiter
            </button>
          </>
        )}

        {step === 'splash_focus' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
              {splashKind === 'debt' ? 'Fokus: Schulden zuerst 🎯' : 'Fokus: Notgroschen aufbauen 🌱'}
            </div>
            <div style={W.mood}>Kurz erklärt — danach geht&apos;s entspannt weiter.</div>
            <div style={{ fontSize: 14, color: '#c9d1d9', lineHeight: 1.55 }}>
              {splashKind === 'debt' ? (
                <>
                  Investment-Themen überspringen wir vorerst. Unter „LevelUp“ siehst du nichts, bis alle Schulden beglichen sind — damit du dich voll auf die Tilgung konzentrieren kannst.
                </>
              ) : (
                <>
                  Ohne Notgroschen überspringen wir die Investment-Fragen im Onboarding — <strong>LevelUp</strong> (Portfolio, Orders, Live-Kurse) bleibt für dich trotzdem nutzbar. Bitte baut parallel euren Notgroschen unter Home auf (⋮ → „Stand bearbeiten“, Ziel ca. {fmtEuro(notgroschenTargetFromIncome(netIncome))}).
                </>
              )}
            </div>
            <button style={W.btn()} onClick={nextFromSplash}>
              Alles klar — weiter 😊
            </button>
          </>
        )}

        {step === 'invest_experienced' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Schon mal in Investieren reingeschaut? 📈</div>
            <div style={W.mood}>Kein Urteil — nur passende nächste Schritte.</div>
            <button type="button" style={W.chip(investExperienced === true)} onClick={() => setInvestExperienced(true)}>
              <span>Ja</span>
              <span>{investExperienced === true ? '✅' : '›'}</span>
            </button>
            <button type="button" style={W.chip(investExperienced === false)} onClick={() => setInvestExperienced(false)}>
              <span>Nein</span>
              <span>{investExperienced === false ? '✅' : '›'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromInvestExperienced} disabled={investExperienced === null}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_topics' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Womit beschäftigst du dich? 🧭</div>
            <div style={W.mood}>Mehrfachwahl — nimm alles, was dich neugierig macht.</div>
            {TOPICS.map((t) => (
              <button key={t} type="button" style={W.chip(topics.includes(t))} onClick={() => toggle(topics, t, setTopics)}>
                <span>{t}</span>
                <span>{topics.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            {topics.includes('Sonstiges') && (
              <input style={{ ...W.input, marginTop: 8 }} placeholder="Sonstiges (kurz)" value={topicOther} onChange={(e) => setTopicOther(e.target.value)} />
            )}
            <button style={W.btn()} onClick={nextFromTopics} disabled={!topics.length}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_amount' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Wie viel hast du ca. investiert? 🪙</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 8 }}>Noch gar nicht? Einfach 0 — auch das ist ein guter Start 🙂</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder="€"
              value={approxInvStr}
              onChange={(e) => setApproxInvStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={nextFromAmount}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_monthly' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Wie viel möchtest du monatlich investieren? 🐖</div>
            <div style={W.mood}>Sparstrumpf-Modus: auch 25 €/Monat sind ein Ritual mit Wirkung.</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder="€ / Monat"
              value={monthlyInvStr}
              onChange={(e) => setMonthlyInvStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={nextFromMonthly}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_risk' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Risikoprofil — wie wild darf&apos;s sein? 🎢</div>
            <div style={W.mood}>Du kannst das später jederzeit anpassen.</div>
            {(
              [
                ['low', 'Wenig Risiko (konservativ)'],
                ['mid', 'Mittel (ausgewogen)'],
                ['high', 'Viel Risiko (aggressiv)'],
              ] as const
            ).map(([k, lab]) => (
              <button key={k} type="button" style={W.chip(risk === k)} onClick={() => setRisk(k)}>
                <span>{lab}</span>
                <span>{risk === k ? '✅' : '›'}</span>
              </button>
            ))}
            <button style={W.btn()} onClick={nextFromRisk} disabled={!risk}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_classes_intent' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>In was möchtest du investieren? 🧩</div>
            <div style={W.mood}>Träume groß — wir halten die Übersicht klein und übersichtlich.</div>
            {CLASSES_INTENT.map((t) => (
              <button key={t} type="button" style={W.chip(classesIntent.includes(t))} onClick={() => toggle(classesIntent, t, setClassesIntent)}>
                <span>{t}</span>
                <span>{classesIntent.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            <button style={W.btn()} onClick={nextFromClassesIntent} disabled={!classesIntent.length}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_classes_held' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>In was bist du investiert? 🗂️</div>
            <div style={W.mood}>Alles, was schon in deinem Depot oder Kopf herumspukt.</div>
            {CLASSES_HELD.map((t) => (
              <button key={t} type="button" style={W.chip(classesHeld.includes(t))} onClick={() => toggle(classesHeld, t, setClassesHeld)}>
                <span>{t}</span>
                <span>{classesHeld.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            {classesHeld.includes('Sonstiges') && (
              <input style={{ ...W.input, marginTop: 8 }} placeholder="Sonstiges" value={heldOther} onChange={(e) => setHeldOther(e.target.value)} />
            )}
            <button style={W.btn()} onClick={nextFromClassesHeld} disabled={!classesHeld.length}>
              Weiter
            </button>
          </>
        )}

        {step === 'invest_details' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Details zu deinen Positionen 🔍</div>
            <div style={W.mood}>Optional — aber hilft für Watchlist und Übersicht.</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12, lineHeight: 1.45 }}>
              Optional: jede Zeile einem Watchlist-Symbol zuordnen (Kaufpreis × Stückzahl = EUR in der App). Leer = automatische Verteilung.
            </div>
            {classesHeld.some((c) => ['Aktien', "ETF's", 'Anleihen'].includes(c)) && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>Aktien / ETF / Anleihen</div>
                {stocks.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                    <input
                      style={W.input}
                      placeholder="Name (z. B. Apple, MSCI World)"
                      value={s.name}
                      onChange={(e) => setStocks((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Kaufpreis €"
                      value={s.buyPriceStr}
                      onChange={(e) =>
                        setStocks((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, buyPriceStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Stückzahl"
                      value={s.qtyStr}
                      onChange={(e) =>
                        setStocks((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, qtyStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <select
                      style={W.input}
                      value={s.mapSym || ''}
                      onChange={(e) => setStocks((prev) => prev.map((x, j) => (j === i ? { ...x, mapSym: e.target.value } : x)))}
                    >
                      <option value="">Watchlist: automatisch</option>
                      {WATCHLIST_MAP_OPTS.map((sym) => (
                        <option key={sym} value={sym}>
                          → {sym}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  style={{ ...W.btn(P.mutedBtn), marginTop: 0 }}
                  onClick={() => setStocks((prev) => [...prev, { name: '', buyPriceStr: '', qtyStr: '', mapSym: '' }])}
                >
                  + Position
                </button>
              </div>
            )}
            {classesHeld.includes('Krypto') && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>Krypto</div>
                {cryptos.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                    <input
                      style={W.input}
                      placeholder="Name / Kürzel"
                      value={s.name}
                      onChange={(e) => setCryptos((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Kaufpreis €"
                      value={s.buyPriceStr}
                      onChange={(e) =>
                        setCryptos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, buyPriceStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Stück"
                      value={s.qtyStr}
                      onChange={(e) =>
                        setCryptos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, qtyStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <select
                      style={W.input}
                      value={s.mapSym || ''}
                      onChange={(e) => setCryptos((prev) => prev.map((x, j) => (j === i ? { ...x, mapSym: e.target.value } : x)))}
                    >
                      <option value="">Watchlist: automatisch (55 % BTC / 45 % ETH)</option>
                      {WATCHLIST_MAP_OPTS.map((sym) => (
                        <option key={sym} value={sym}>
                          → {sym}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  style={{ ...W.btn(P.mutedBtn), marginTop: 0 }}
                  onClick={() => setCryptos((prev) => [...prev, { name: '', buyPriceStr: '', qtyStr: '', mapSym: '' }])}
                >
                  + Krypto
                </button>
              </div>
            )}
            {classesHeld.includes('Immobilien') && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>Immobilien</div>
                {immos.map((m, i) => (
                  <div key={i} style={{ border: `1px solid ${P.line}`, borderRadius: 10, padding: 10, marginBottom: 8, display: 'grid', gap: 6 }}>
                    <input style={W.input} placeholder="Ort / PLZ" value={m.ortPlz} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, ortPlz: e.target.value } : x)))} />
                    <input style={W.input} placeholder="Straße" value={m.strasse} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, strasse: e.target.value } : x)))} />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Kaufpreis €"
                      value={m.kaufpreisStr}
                      onChange={(e) =>
                        setImmos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, kaufpreisStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Wohnfläche m²"
                      value={m.wohnflaecheStr}
                      onChange={(e) =>
                        setImmos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, wohnflaecheStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Kaltmiete €"
                      value={m.kaltmieteStr}
                      onChange={(e) =>
                        setImmos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, kaltmieteStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder="Nebenkosten €"
                      value={m.nebenkostenStr}
                      onChange={(e) =>
                        setImmos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, nebenkostenStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input style={W.input} placeholder="Letzte Mieterhöhung (Datum)" value={m.letzteErhebung} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, letzteErhebung: e.target.value } : x)))} />
                    <input style={W.input} placeholder="Erhöhungszyklus (z. B. 3 Jahre)" value={m.zyklusJahre} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, zyklusJahre: e.target.value } : x)))} />
                    <select
                      style={W.input}
                      value={m.mapSym || ''}
                      onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, mapSym: e.target.value } : x)))}
                    >
                      <option value="">Watchlist-Anteil: automatisch (6 % Kaufpreis → MSCI/SPY)</option>
                      {WATCHLIST_MAP_OPTS.map((sym) => (
                        <option key={sym} value={sym}>
                          Anteil auf {sym}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  style={{ ...W.btn(P.mutedBtn), marginTop: 0 }}
                  onClick={() =>
                    setImmos((prev) => [
                      ...prev,
                      {
                        ortPlz: '',
                        strasse: '',
                        kaufpreisStr: '',
                        wohnflaecheStr: '',
                        kaltmieteStr: '',
                        nebenkostenStr: '',
                        letzteErhebung: '',
                        zyklusJahre: '',
                        mapSym: '',
                      },
                    ])
                  }
                >
                  + Immobilie
                </button>
              </div>
            )}
            {classesHeld.includes('P2P') && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>P2P</div>
                <input
                  style={{ ...W.input, marginBottom: 8 }}
                  inputMode="decimal"
                  placeholder="Gesamtinvest €"
                  value={p2p.gesamtStr}
                  onChange={(e) => setP2p((x) => ({ ...x, gesamtStr: normalizeDecimalInput(e.target.value) }))}
                />
                <input
                  style={W.input}
                  inputMode="decimal"
                  placeholder="Profit %"
                  value={p2p.profitPctStr}
                  onChange={(e) => setP2p((x) => ({ ...x, profitPctStr: normalizeDecimalInput(e.target.value) }))}
                />
                <select
                  style={W.input}
                  value={p2p.mapSym || ''}
                  onChange={(e) => setP2p((x) => ({ ...x, mapSym: e.target.value }))}
                >
                  <option value="">Watchlist: automatisch (Mix)</option>
                  {WATCHLIST_MAP_OPTS.map((sym) => (
                    <option key={sym} value={sym}>
                      Gesamtinvest auf {sym}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button style={W.btn()} onClick={nextFromDetails}>
              Weiter
            </button>
          </>
        )}

        {step === 'why_here' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Warum bist du hier? 💬</div>
            <div style={W.mood}>Damit wir die App für dich noch passender machen.</div>
            {WHY.map((t) => (
              <button key={t} type="button" style={W.chip(why.includes(t))} onClick={() => toggle(why, t, setWhy)}>
                <span>{t}</span>
                <span>{why.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            {why.includes('Sonstiges') && <input style={{ ...W.input, marginTop: 8 }} placeholder="Sonstiges" value={whyOther} onChange={(e) => setWhyOther(e.target.value)} />}
            <button style={W.btn()} onClick={nextFromWhy} disabled={!why.length}>
              Weiter
            </button>
          </>
        )}

        {step === 'finish' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <CleverFinanceLogo size={72} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', lineHeight: 1.35 }}>
              🎉 {p.subj === 'ihr' ? 'Ihr' : 'Du'} bist startklar!
            </div>
            <div style={{ fontSize: 14, color: '#7d8590', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Deine Antworten sind gespeichert. Gleich führt dich eine kurze Tour mit Licht & Sprechblase durch die App. ✨
            </div>
            <button style={W.btn()} onClick={submitWizard}>
              Clever Finance starten 🚀
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function fmtEuro(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}
