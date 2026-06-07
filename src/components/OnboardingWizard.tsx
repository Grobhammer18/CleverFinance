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
import { MONEY_CURRENCIES, moneyCurrencyOptionLabel, moneyCurrencySymbol, normalizeBaseCurrency } from '../currencyFx';
import { useLocale } from '../i18n/LocaleContext';
import { financeWhoSubj, getOnboardingCopy } from '../i18n/onboardingStrings';

type Step =
  | 'intro'
  | 'finance_who'
  | 'base_currency'
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
  const { locale } = useLocale();
  const ob = useMemo(() => getOnboardingCopy(locale), [locale]);
  const [step, setStep] = useState<Step>('intro');
  const [financeWho, setFinanceWho] = useState<FinanceWho>('alone');
  const [baseCurrency, setBaseCurrency] = useState('EUR');
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

  const netIncome = useMemo(() => parseNum(netIncomeStr), [netIncomeStr]);
  const curSym = useMemo(() => moneyCurrencySymbol(baseCurrency), [baseCurrency]);
  const branch = useMemo(() => {
    const emHas = emergencyHas === true;
    return computeBranch({ hasDebt: hasDebt === true, debtKinds, emergencyHas: emHas });
  }, [hasDebt, debtKinds, emergencyHas]);

  const investSkipped = branch.investSkipped;

  const go = (s: Step) => setStep(s);

  const initDebtRows = (n: number) => {
    const kind0: 'consumer' | 'house' = debtKinds.consumer ? 'consumer' : 'house';
    const rows: DebtRowForm[] = Array.from({ length: n }, (_, i) => ({
      name: i === 0 ? ob.defaultDebtName : '',
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
      topics: topics.includes(ob.common.other) && topicOther ? [...topics.filter((t) => t !== ob.common.other), topicOther] : topics,
      approxInvested: parseNum(approxInvStr) || 0,
      monthlyWant: parseNum(monthlyInvStr) || 0,
      risk: risk || 'mid',
      desiredClasses: classesIntent,
      heldClasses: classesHeld.includes(ob.common.other) && heldOther ? [...classesHeld.filter((t) => t !== ob.common.other), heldOther] : classesHeld,
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
      baseCurrency: normalizeBaseCurrency(baseCurrency),
      netIncomeMonthly: net,
      hasDebt: hasDebt === true,
      debtKinds: { ...debtKinds },
      debts,
      emergency: em,
      investSkipped,
      levelUpMode: branch.levelUpMode,
      invest: investSkipped ? null : buildInvestDraft(),
      whyHere: why.includes(ob.common.other) && whyOther.trim()
        ? [...why.filter((w) => w !== ob.common.other), whyOther.trim()]
        : why,
    };
    onComplete(payload);
  };

  const nextFromIntro = () => go('finance_who');
  const nextFromFinanceWho = () => go('base_currency');
  const nextFromBaseCurrency = () => go('net_income');
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
      'base_currency',
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

  const stepTotal = 20;
  const subj = financeWhoSubj(financeWho, locale);

  return (
    <div style={W.app}>
      <div style={{ ...W.row, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#7d8590', fontWeight: 700 }}>{ob.header}</div>
        <div style={{ fontSize: 12, color: '#7d8590' }}>{ob.headerTime}</div>
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
            <div style={{ ...W.logo, textAlign: 'center', marginTop: 4 }}>{ob.intro.hey(subj)}</div>
            <div style={{ fontSize: 15, color: '#9aa7b5', textAlign: 'center', marginTop: 6, lineHeight: 1.5, fontWeight: 600 }}>
              {ob.intro.subline}
            </div>
            <div style={{ fontSize: 14, color: '#c9d1d9', textAlign: 'center', marginTop: 14, lineHeight: 1.55 }}>
              {ob.intro.body(subj)}
            </div>
            <button style={W.btn()} onClick={nextFromIntro}>
              {ob.intro.btn}
            </button>
          </>
        )}

        {step === 'finance_who' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {ob.financeWho.title.replace('{subj}', subj)}
            </div>
            <div style={W.mood}>{ob.financeWho.mood}</div>
            {(
              [
                ['alone', ob.financeWho.alone],
                ['partner', ob.financeWho.partner],
                ['delegate', ob.financeWho.delegate],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" style={W.chip(financeWho === id)} onClick={() => setFinanceWho(id)}>
                <span>{label}</span>
                <span>{financeWho === id ? '✅' : '›'}</span>
              </button>
            ))}
            <button style={W.btn()} onClick={nextFromFinanceWho}>
              {ob.financeWho.btn}
            </button>
          </>
        )}

        {step === 'base_currency' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.baseCurrency.title}</div>
            <div style={W.mood}>{ob.baseCurrency.mood}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
              {MONEY_CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  style={W.chip(baseCurrency === c.code)}
                  onClick={() => setBaseCurrency(c.code)}
                >
                  <span>{moneyCurrencyOptionLabel(c.code)}</span>
                  <span>{baseCurrency === c.code ? '✅' : '›'}</span>
                </button>
              ))}
            </div>
            <button style={W.btn()} onClick={nextFromBaseCurrency}>
              {ob.baseCurrency.btn}
            </button>
          </>
        )}

        {step === 'net_income' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? ob.netIncome.titlePartner : ob.netIncome.titleAlone}
            </div>
            <div style={W.mood}>{ob.netIncome.mood}</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 10 }}>
              {ob.netIncome.hint(moneyCurrencySymbol(baseCurrency))}
            </div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder={ob.netIncome.placeholder}
              value={netIncomeStr}
              onChange={(e) => setNetIncomeStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={nextFromNetIncome} disabled={!Number.isFinite(netIncome) || netIncome <= 0}>
              {ob.netIncome.btn}
            </button>
          </>
        )}

        {step === 'debts_yn' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? ob.debtsYn.titlePartner : ob.debtsYn.titleAlone}
            </div>
            <div style={W.mood}>{ob.debtsYn.mood}</div>
            <button type="button" style={W.chip(hasDebt === true)} onClick={() => setHasDebt(true)}>
              <span>{ob.common.yes}</span>
              <span>{hasDebt === true ? '✅' : '›'}</span>
            </button>
            <button type="button" style={W.chip(hasDebt === false)} onClick={() => setHasDebt(false)}>
              <span>{ob.common.no}</span>
              <span>{hasDebt === false ? '✅' : '›'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromDebtsYn} disabled={hasDebt === null}>
              {ob.debtsYn.btn}
            </button>
          </>
        )}

        {step === 'debts_types' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.debtsTypes.title}</div>
            <div style={W.mood}>{ob.debtsTypes.mood}</div>
            <button
              type="button"
              style={W.chip(debtKinds.consumer)}
              onClick={() => setDebtKinds((k) => ({ ...k, consumer: !k.consumer }))}
            >
              <span>{ob.debtsTypes.consumer}</span>
              <span>{debtKinds.consumer ? '✅' : '⬜'}</span>
            </button>
            <button type="button" style={W.chip(debtKinds.house)} onClick={() => setDebtKinds((k) => ({ ...k, house: !k.house }))}>
              <span>{ob.debtsTypes.house}</span>
              <span>{debtKinds.house ? '✅' : '⬜'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromDebtTypes} disabled={!debtKinds.consumer && !debtKinds.house}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'debts_count' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.debtsCount.title}</div>
            <div style={W.mood}>{ob.debtsCount.mood}</div>
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
              placeholder={ob.debtsCount.placeholder}
              value={String(debtCount)}
              onChange={(e) => setDebtCount(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            />
            <button style={W.btn()} onClick={nextFromDebtCount}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'debts_entries' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.debtsEntries.title}</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12 }}>{ob.debtsEntries.hint}</div>
            {debtRows.map((row, idx) => (
              <div key={idx} style={{ border: `1px solid ${P.line}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{ob.debtsEntries.loanN(idx + 1)}</div>
                <select
                  style={{ ...W.input, marginBottom: 8 }}
                  value={row.kind}
                  onChange={(e) => {
                    const v = e.target.value as 'consumer' | 'house';
                    setDebtRows((prev) => prev.map((r, i) => (i === idx ? { ...r, kind: v } : r)));
                  }}
                >
                  <option value="consumer">{ob.debtsEntries.consumer}</option>
                  <option value="house">{ob.debtsEntries.house}</option>
                </select>
                <input
                  style={{ ...W.input, marginBottom: 8 }}
                  placeholder={ob.debtsEntries.namePlaceholder}
                  value={row.name}
                  onChange={(e) => setDebtRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                />
                <input
                  style={{ ...W.input, marginBottom: 8 }}
                  placeholder={ob.debtsEntries.totalPlaceholder(curSym)}
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
                  placeholder={ob.debtsEntries.monthlyPlaceholder(curSym)}
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
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'emergency_yn' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? ob.emergencyYn.titlePartner : ob.emergencyYn.titleAlone}
            </div>
            <div style={W.mood}>{ob.emergencyYn.mood}</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12 }}>
              {ob.emergencyYn.targetHint(ob.fmtMoney(notgroschenTargetFromIncome(netIncome), baseCurrency, locale))}
            </div>
            <button type="button" style={W.chip(emergencyHas === true)} onClick={() => setEmergencyHas(true)}>
              <span>{ob.common.yes}</span>
              <span>{emergencyHas === true ? '✅' : '›'}</span>
            </button>
            <button type="button" style={W.chip(emergencyHas === false)} onClick={() => setEmergencyHas(false)}>
              <span>{ob.common.no}</span>
              <span>{emergencyHas === false ? '✅' : '›'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromEmergencyYn} disabled={emergencyHas === null}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'emergency_balance' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.emergencyBalance.title}</div>
            <div style={W.mood}>{ob.emergencyBalance.mood}</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder={ob.emergencyBalance.placeholder(curSym)}
              value={emergencyBalanceStr}
              onChange={(e) => setEmergencyBalanceStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={afterEmergencyBranch}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'emergency_monthly' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {financeWho === 'partner' ? ob.emergencyMonthly.titlePartner : ob.emergencyMonthly.titleAlone}
            </div>
            <div style={W.mood}>{ob.emergencyMonthly.mood}</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder={ob.emergencyMonthly.placeholder(curSym)}
              value={emergencyMonthlyStr}
              onChange={(e) => setEmergencyMonthlyStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={afterEmergencyBranch}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'splash_focus' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
              {splashKind === 'debt' ? ob.splashFocus.debtTitle : ob.splashFocus.emergencyTitle}
            </div>
            <div style={W.mood}>{ob.splashFocus.mood}</div>
            <div style={{ fontSize: 14, color: '#c9d1d9', lineHeight: 1.55 }}>
              {splashKind === 'debt' ? ob.splashFocus.debtBody : ob.splashFocus.emergencyBody(ob.fmtMoney(notgroschenTargetFromIncome(netIncome), baseCurrency, locale))}
            </div>
            <button style={W.btn()} onClick={nextFromSplash}>
              {ob.splashFocus.btn}
            </button>
          </>
        )}

        {step === 'invest_experienced' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investExperienced.title}</div>
            <div style={W.mood}>{ob.investExperienced.mood}</div>
            <button type="button" style={W.chip(investExperienced === true)} onClick={() => setInvestExperienced(true)}>
              <span>{ob.common.yes}</span>
              <span>{investExperienced === true ? '✅' : '›'}</span>
            </button>
            <button type="button" style={W.chip(investExperienced === false)} onClick={() => setInvestExperienced(false)}>
              <span>{ob.common.no}</span>
              <span>{investExperienced === false ? '✅' : '›'}</span>
            </button>
            <button style={W.btn()} onClick={nextFromInvestExperienced} disabled={investExperienced === null}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_topics' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investTopics.title}</div>
            <div style={W.mood}>{ob.investTopics.mood}</div>
            {ob.topics.map((t) => (
              <button key={t} type="button" style={W.chip(topics.includes(t))} onClick={() => toggle(topics, t, setTopics)}>
                <span>{t}</span>
                <span>{topics.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            {topics.includes(ob.common.other) && (
              <input style={{ ...W.input, marginTop: 8 }} placeholder={ob.investTopics.otherPlaceholder} value={topicOther} onChange={(e) => setTopicOther(e.target.value)} />
            )}
            <button style={W.btn()} onClick={nextFromTopics} disabled={!topics.length}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_amount' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investAmount.title}</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 8 }}>{ob.investAmount.hint}</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder={ob.investAmount.placeholder(curSym)}
              value={approxInvStr}
              onChange={(e) => setApproxInvStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={nextFromAmount}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_monthly' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investMonthly.title}</div>
            <div style={W.mood}>{ob.investMonthly.mood}</div>
            <input
              style={W.input}
              inputMode="decimal"
              placeholder={ob.investMonthly.placeholder(curSym)}
              value={monthlyInvStr}
              onChange={(e) => setMonthlyInvStr(normalizeDecimalInput(e.target.value))}
            />
            <button style={W.btn()} onClick={nextFromMonthly}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_risk' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investRisk.title}</div>
            <div style={W.mood}>{ob.investRisk.mood}</div>
            {(
              [
                ['low', ob.investRisk.low],
                ['mid', ob.investRisk.mid],
                ['high', ob.investRisk.high],
              ] as const
            ).map(([k, lab]) => (
              <button key={k} type="button" style={W.chip(risk === k)} onClick={() => setRisk(k)}>
                <span>{lab}</span>
                <span>{risk === k ? '✅' : '›'}</span>
              </button>
            ))}
            <button style={W.btn()} onClick={nextFromRisk} disabled={!risk}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_classes_intent' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investClassesIntent.title}</div>
            <div style={W.mood}>{ob.investClassesIntent.mood}</div>
            {ob.classesIntent.map((t) => (
              <button key={t} type="button" style={W.chip(classesIntent.includes(t))} onClick={() => toggle(classesIntent, t, setClassesIntent)}>
                <span>{t}</span>
                <span>{classesIntent.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            <button style={W.btn()} onClick={nextFromClassesIntent} disabled={!classesIntent.length}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_classes_held' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investClassesHeld.title}</div>
            <div style={W.mood}>{ob.investClassesHeld.mood}</div>
            {ob.classesHeld.map((t) => (
              <button key={t} type="button" style={W.chip(classesHeld.includes(t))} onClick={() => toggle(classesHeld, t, setClassesHeld)}>
                <span>{t}</span>
                <span>{classesHeld.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            {classesHeld.includes(ob.common.other) && (
              <input style={{ ...W.input, marginTop: 8 }} placeholder={ob.investClassesHeld.otherPlaceholder} value={heldOther} onChange={(e) => setHeldOther(e.target.value)} />
            )}
            <button style={W.btn()} onClick={nextFromClassesHeld} disabled={!classesHeld.length}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'invest_details' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.investDetails.title}</div>
            <div style={W.mood}>{ob.investDetails.mood}</div>
            <div style={{ fontSize: 12, color: '#7d8590', marginBottom: 12, lineHeight: 1.45 }}>
              {ob.investDetails.hint}
            </div>
            {classesHeld.some((c) => ob.stockHeldClasses.includes(c)) && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>{ob.investDetails.stockLabel}</div>
                {stocks.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                    <input
                      style={W.input}
                      placeholder={ob.investDetails.nameStockPlaceholder}
                      value={s.name}
                      onChange={(e) => setStocks((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder={ob.investDetails.buyPricePlaceholder(curSym)}
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
                      placeholder={ob.investDetails.qtyPlaceholder}
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
                      <option value="">{ob.investDetails.watchlistAuto}</option>
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
                  {ob.investDetails.addPosition}
                </button>
              </div>
            )}
            {classesHeld.includes(ob.cryptoHeldClass) && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>{ob.investDetails.cryptoLabel}</div>
                {cryptos.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                    <input
                      style={W.input}
                      placeholder={ob.investDetails.cryptoNamePlaceholder}
                      value={s.name}
                      onChange={(e) => setCryptos((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder={ob.investDetails.buyPricePlaceholder(curSym)}
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
                      placeholder={ob.investDetails.qtyCryptoPlaceholder}
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
                      <option value="">{ob.investDetails.watchlistCryptoAuto}</option>
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
                  {ob.investDetails.addCrypto}
                </button>
              </div>
            )}
            {classesHeld.includes(ob.propertyHeldClass) && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>{ob.investDetails.propertyLabel}</div>
                {immos.map((m, i) => (
                  <div key={i} style={{ border: `1px solid ${P.line}`, borderRadius: 10, padding: 10, marginBottom: 8, display: 'grid', gap: 6 }}>
                    <input style={W.input} placeholder={ob.investDetails.propertyLocationPlaceholder} value={m.ortPlz} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, ortPlz: e.target.value } : x)))} />
                    <input style={W.input} placeholder={ob.investDetails.propertyStreetPlaceholder} value={m.strasse} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, strasse: e.target.value } : x)))} />
                    <input
                      style={W.input}
                      inputMode="decimal"
                      placeholder={ob.investDetails.buyPricePlaceholder(curSym)}
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
                      placeholder={ob.investDetails.propertyAreaPlaceholder}
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
                      placeholder={ob.investDetails.propertyRentPlaceholder(curSym)}
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
                      placeholder={ob.investDetails.propertyUtilitiesPlaceholder(curSym)}
                      value={m.nebenkostenStr}
                      onChange={(e) =>
                        setImmos((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, nebenkostenStr: normalizeDecimalInput(e.target.value) } : x)),
                        )
                      }
                    />
                    <input style={W.input} placeholder={ob.investDetails.propertyRaiseDatePlaceholder} value={m.letzteErhebung} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, letzteErhebung: e.target.value } : x)))} />
                    <input style={W.input} placeholder={ob.investDetails.propertyRaiseCyclePlaceholder} value={m.zyklusJahre} onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, zyklusJahre: e.target.value } : x)))} />
                    <select
                      style={W.input}
                      value={m.mapSym || ''}
                      onChange={(e) => setImmos((prev) => prev.map((x, j) => (j === i ? { ...x, mapSym: e.target.value } : x)))}
                    >
                      <option value="">{ob.investDetails.watchlistPropertyAuto}</option>
                      {WATCHLIST_MAP_OPTS.map((sym) => (
                        <option key={sym} value={sym}>
                          {ob.investDetails.watchlistPropertyOn(sym)}
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
                  {ob.investDetails.addProperty}
                </button>
              </div>
            )}
            {classesHeld.includes(ob.p2pHeldClass) && (
              <div style={{ marginBottom: 14 }}>
                <div style={W.label}>{ob.investDetails.p2pLabel}</div>
                <input
                  style={{ ...W.input, marginBottom: 8 }}
                  inputMode="decimal"
                  placeholder={ob.investDetails.p2pTotalPlaceholder(curSym)}
                  value={p2p.gesamtStr}
                  onChange={(e) => setP2p((x) => ({ ...x, gesamtStr: normalizeDecimalInput(e.target.value) }))}
                />
                <input
                  style={W.input}
                  inputMode="decimal"
                  placeholder={ob.investDetails.p2pProfitPlaceholder}
                  value={p2p.profitPctStr}
                  onChange={(e) => setP2p((x) => ({ ...x, profitPctStr: normalizeDecimalInput(e.target.value) }))}
                />
                <select
                  style={W.input}
                  value={p2p.mapSym || ''}
                  onChange={(e) => setP2p((x) => ({ ...x, mapSym: e.target.value }))}
                >
                  <option value="">{ob.investDetails.watchlistP2pAuto}</option>
                  {WATCHLIST_MAP_OPTS.map((sym) => (
                    <option key={sym} value={sym}>
                      {ob.investDetails.watchlistP2pOn(sym)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button style={W.btn()} onClick={nextFromDetails}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'why_here' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{ob.whyHereStep.title}</div>
            <div style={W.mood}>{ob.whyHereStep.mood}</div>
            {ob.whyHere.map((t) => (
              <button key={t} type="button" style={W.chip(why.includes(t))} onClick={() => toggle(why, t, setWhy)}>
                <span>{t}</span>
                <span>{why.includes(t) ? '✓' : ''}</span>
              </button>
            ))}
            {why.includes(ob.common.other) && (
              <input style={{ ...W.input, marginTop: 8 }} placeholder={ob.common.other} value={whyOther} onChange={(e) => setWhyOther(e.target.value)} />
            )}
            <button style={W.btn()} onClick={nextFromWhy} disabled={!why.length}>
              {ob.common.continue}
            </button>
          </>
        )}

        {step === 'finish' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <CleverFinanceLogo size={72} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', lineHeight: 1.35 }}>
              {financeWho === 'partner' ? ob.finish.titlePartner : ob.finish.titleAlone}
            </div>
            <div style={{ fontSize: 14, color: '#7d8590', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              {ob.finish.body}
            </div>
            <button style={W.btn()} onClick={submitWizard}>
              {ob.finish.btn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
