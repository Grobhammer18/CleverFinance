# 🏆 AllWin — Cursor Master Prompt
# React Web App | Finanz-Freedom App

> **Zwei Ebenen in diesem Dokument:**  
> 1) **Zielspezifikation** (darunter) = Produktvision / MVP-Wunsch.  
> 2) **IST-ZUSTAND REPOSITORY** = tatsächlicher Code in **diesem** Repository (damit Cursor nicht gegen die Realität arbeitet).

---

## 🎯 PROJEKT OVERVIEW

Baue eine React Web App namens **AllWin** — eine persönliche Finanz-App mit Gamification.
- Dark Theme: Hintergrund #0d1117, Akzent #00d4aa (Teal), Gold #f8d03a, Rot #e02020
- Font: DM Sans (Google Fonts)
- Mobile-first Design (max-width 430px zentriert)
- Vollständig auf Deutsch

---

## 📌 IST-ZUSTAND REPOSITORY

Abschnitt beschreibt den **aktuellen Code**, Pfade relativ zum **Repository-Root** (dieser Ordner).

### Tech-Stack

| Bereich | Technologie |
|--------|-------------|
| Frontend | **React 19**, **TypeScript**, **Vite 6** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`), dazu viele **Inline-Styles** in `AllWin.tsx` |
| UI | **shadcn / Base UI**, `lucide-react`, `motion`, `recharts` (teilweise) |
| Backend (optional) | **Express**: `server/billingServer.js` — **Stripe**, **dotenv**, Auth |
| Auth | Bearer-Token; **Google** (`google-auth-library`); **Apple** (`jose`) |
| Persistenz (eingeloggt) | `GET` / `PUT` **`/api/user/state`** → `server/data/users.json` |

### Skripte

```bash
npm install
npm run dev          # Vite, Port 3000 (siehe package.json)
npm run dev:billing  # Billing + Auth + User-State, Port 4242 (env: BILLING_PORT)
npm run lint         # tsc --noEmit
```

- In **`vite.config.ts`**: Proxy **`/api`** → `http://localhost:4242` (wenn Billing läuft).
- **`src/App.tsx`**: rendert nur **`import AllWin from './components/AllWin'`**.

### Relevante Dateistruktur (Ist)

```
./
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── constants.ts
│   ├── vite-env.d.ts
│   └── components/
│       ├── AllWin.tsx          # Haupt-UI: alle Tabs, Onboarding, Sync
│       ├── Investments.tsx     # separater Screen (aktuell nicht in App.tsx eingebunden)
│       ├── Debts.tsx, Transactions.tsx, Overview.tsx, Pricing.tsx, Achievements.tsx
│       └── ui/                 # Card, Button, … (shadcn-artig)
├── server/
│   ├── billingServer.js
│   └── data/users.json         # bei Nutzung von Auth + State
├── vite.config.ts
├── .env.example
└── package.json
```

### Tabs (`AllWin.tsx`)

| `tab` id | UI-Label | Kurzbeschreibung |
|----------|----------|------------------|
| `dashboard` | Home | Monatssaldo aus Money, Schulden-Kachel, Portfolio, Jahresbalken |
| `transactions` | Money | Buchungen erfassen + Liste |
| `debts` | Boost | Schulden, Archiv, Abbau-Visualisierung |
| `invest` | LevelUp | Portfolio (Stück/Kauf), Live-Markt (**Paywall** ohne bezahltes Abo) |
| `profile` | Mehr | Login/Register, Google/Apple, Abo, Profil, Benachrichtigungen |

### Money ↔ Home (Datenlogik)

- **Quelle für Einnahmen/Ausgaben auf Home** und **Jahresbalken**: nur **`transactions`** im gleichen State wie Money.
- Felder u. a.: `type: 'einnahme' | 'ausgabe'`, `amount` (String), `category`, `note`, **`date`**.
- **Neue** Buchungen: `date` als **ISO `YYYY-MM-DD`**.
- **Ältere** Einträge mit **`TT.MM.JJJJ`** (früher `toLocaleDateString`) werden beim Monats-Aggregat weiter erkannt.
- **Kalendermonat / -jahr** = `new Date()` zum Rendern; Aggregation pro Jahr für die 12 Balken.
- Link auf Home: dezenter Sprung **„In Money bearbeiten“** (Tab `transactions`).

### Billing-API (Auszug `billingServer.js`)

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`
- `POST /api/auth/oauth/google`, `POST /api/auth/oauth/apple`
- `GET` / `PUT /api/user/state` (Authorization Bearer)
- Stripe: `POST /api/billing/create-checkout-session`, `GET /api/billing/checkout-session/:sessionId`, `POST /api/billing/webhook`
- **Kein** KI-Endpoint (`/api/ai/gemini` entfernt). **Kein** `@google/genai` im `package.json`.

### Umgebungsvariablen

Siehe **`.env.example`** im Repo-Root. Billing optional: u. a. `VITE_BILLING_API_URL`, `APP_URL`, `AUTH_SECRET`, `STRIPE_*`, Stripe-Price-IDs, `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`, Apple-IDs, `VITE_DEV_FORCE_ELITE`.

**Hinweis:** Es gibt **keine** Gemini-/KI-Anbindung im Code; das Root-**`README.md`** erwähnt keinen Gemini-Key mehr.

### Vision vs. Repo (Kurz)

| Zielspec (unten) | Repo heute |
|------------------|------------|
| Viele `screens/` + AppContext | Ein großes **`AllWin.tsx`** + lokaler State + optional **`/api/user/state`** |
| KI-Empfehlungen | **Nicht** implementiert |
| Risiko / Anlagetypen LevelUp | **Entfernt** |
| Externe Markt-APIs | Kurse **simuliert** (App-intern), nicht CoinGecko/AlphaVantage |
| PWA | nicht fokussiert |

---

## 🗂️ PROJEKTSTRUKTUR

```
src/
├── components/
│   ├── UI/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Input.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── Toast.jsx
│   │   └── Badge.jsx
│   ├── charts/
│   │   ├── BarChart.jsx
│   │   ├── LineChart.jsx
│   │   └── DonutChart.jsx
│   └── layout/
│       ├── TabBar.jsx
│       └── Header.jsx
├── screens/
│   ├── onboarding/
│   │   ├── Welcome.jsx
│   │   ├── Step1_Finanzen.jsx
│   │   ├── Step2_Schulden.jsx
│   │   ├── Step3_Notgroschen.jsx
│   │   ├── Step4_Investment.jsx
│   │   └── Step5_Motivation.jsx
│   ├── Dashboard.jsx
│   ├── Transactions.jsx
│   ├── DebtTracker.jsx
│   ├── Investment.jsx
│   ├── Market.jsx
│   └── Profile.jsx
├── context/
│   └── AppContext.jsx
├── hooks/
│   ├── useLocalStorage.js
│   └── useMarketData.js
├── utils/
│   ├── formatters.js
│   └── calculations.js
└── App.jsx
```

---

## 🔐 STATE MANAGEMENT (AppContext)

```javascript
const initialState = {
  // User
  user: {
    name: "",
    email: "",
    motivation: [],
  },

  // Onboarding
  onboardingComplete: false,
  onboardingData: {
    finanzSituation: "", // "alleine" | "partner" | "fremdverwaltet"
    nettoEinkommen: 0,
    schulden: [],        // [{ name, typ, betrag, rate }]
    notgroschen: 0,
    notgroschenRate: 0,
    hatInvestiert: false,
    investmentErfahrung: [],
    investiertBetrag: 0,
    monatlicheInvestRate: 0,
    risikoProfil: "",    // "low" | "mid" | "high"
    assets: {
      aktien: [],        // [{ name, isin, stueck, kaufpreis }]
      krypto: [],        // [{ name, kuerzel, stueck, kaufpreis }]
      immobilien: [],    // [{ ort, plz, kaufpreis, groesse, kaltmiete, nebenkosten, letzteErhoehung, zyklus }]
    }
  },

  // Transactions
  transactions: [],
  // [{ id, type: "einnahme"|"ausgabe", amount, category, subcategory, note, date, paymentMethod }]

  // Debts (sync mit onboarding)
  debts: [],
  // [{ id, name, typ, total, remaining, rate, interest }]

  // Notgroschen
  notgroschenAktuell: 0,
  notgroschenZiel: 0,   // 3x Gehalt

  // Portfolio
  portfolio: {
    aktien: [],
    krypto: [],
    immobilien: [],
  },

  // Achievements
  achievements: [],
  // ["erste_buchung", "schulden_frei", "notgroschen_voll", "10k_investiert", ...]
}
```

---

## 📱 SCREEN 1 — ONBOARDING

### Welcome Screen
```
- AllWin Logo (Strohhut + "AllWin" Schriftzug)
- Headline: "Deine finanzielle Freiheit beginnt hier"
- Subtext: "Wir stellen dir ein paar Fragen um möglichst 
  individuell & smart mit dir zu arbeiten"
- Button: "Los geht's"
- Login: Apple / Google / Email
```

### Step 1 — Finanzsituation
```
Frage 1: "Wie verwaltest du deine Finanzen?"
→ [Alleine] [Mit Partner/in] [Partner gibt mir das Geld]

Frage 2: "Wie viel Netto verdient ihr zusammen?"
→ Eingabefeld (€)
→ Wenn "Alleine" gewählt: "Wie viel verdienst du netto?"
```

### Step 2 — Schulden
```
Frage: "Hast du Schulden?"
→ [Nein] [Ja]

Wenn JA:
  → "Was für Schulden hast du?"
    ☐ Dispo / Konsumkredit
    ☐ Hauskredit / Immobilienkredit

  → "Wie viele Kredite hast du?"
    [1] [2] [3] [4] [Eigene Zahl eingeben]

  → Für jeden Kredit:
    "Wie hoch ist Kredit {n}?"
    [Name des Kredits] [Betrag €]

  → "Wie hoch ist die monatliche Rate?"
    Für jeden Kredit: [Rate €/Monat]
```

### Step 3 — Notgroschen
```
Frage: "Hast du einen Notgroschen aufgebaut?"
Hinweis: "(Empfehlung: 2-3 Monatsgehälter)"
→ [Ja] [Nein]

Wenn NEIN:
  → "Wie viel möchtest du monatlich in deinen Notgroschen investieren?"
    [Eingabe €]

Wenn JA:
  → "Wie viel hast du bereits angespart?"
    [Eingabe €]
```

### LOGIK — Investment freischalten:
```javascript
const showInvestment = (data) => {
  const { schulden, hatNotgroschen, schuldTyp } = data;
  
  // Schulden (Konsum) + kein Notgroschen → KEIN Investment
  if (schulden.length > 0 && schuldTyp === "konsum" && !hatNotgroschen) 
    return false;
  
  // Kein Kredit + kein Notgroschen → Investment ANZEIGEN
  if (schulden.length === 0 && !hatNotgroschen) 
    return true;
  
  // Hauskredit + Notgroschen → KEIN Investment
  if (schuldTyp === "haus" && hatNotgroschen) 
    return false;
  
  // Kein Kredit + Notgroschen → Investment ANZEIGEN ✅
  if (schulden.length === 0 && hatNotgroschen) 
    return true;
  
  return false;
};
```

### Step 4 — Investment (nur wenn freigeschaltet)
```
Frage: "Hast du dich mit Investieren befasst?"
→ [Ja] [Nein → Investment Seite wird später freigeschaltet]

Wenn JA:
  → "Womit hast du dich beschäftigt?" (Mehrfachauswahl)
    ☐ Aktien
    ☐ Krypto
    ☐ Immobilien (vermietet / zum Flippen)
    ☐ P2P
    ☐ ETFs / Fonds
    ☐ Lebensversicherung

  → "Wie viel hast du ca. investiert?" [€] (0 wenn noch nichts)
  → "Wie viel möchtest du monatlich investieren?" [€]

  → "Wie ist dein Risikoprofil?"
    [🛡️ Konservativ] [⚖️ Ausgewogen] [🚀 Aggressiv]

  → "In was bist du investiert?" (Mehrfachauswahl)
    ☐ ETFs / Fonds ☐ Aktien ☐ Krypto
    ☐ Lebensversicherung ☐ Immobilien ☐ Sonstiges

  → Für jede gewählte Kategorie Eingabe:

    AKTIEN: [Name / ISIN] [Kaufpreis] [Stückzahl] + weitere hinzufügen
    KRYPTO: [Name / Kürzel] [Kaufpreis] [Stückzahl] + weitere hinzufügen
    IMMOBILIEN: 
      [Ort] [PLZ] [Kaufpreis] [Größe m²]
      [Kaltmiete €] [Nebenkosten €]
      [Letzte Mieterhöhung Datum]
      [Erhöhungszyklus: 1J / 2J / 3J]
```

### Step 5 — Motivation (letzter Schritt)
```
Frage: "Warum bist du hier?" (Mehrfachauswahl)
  ☐ Einfache Übersicht über meine Finanzen haben
  ☐ Meine Familie absichern
  ☐ Alles auf einen Blick haben
  ☐ Mich endlich mit Finanzen beschäftigen
  ☐ Schulden abbezahlen
  ☐ Investieren lernen
  ☐ Sonstiges [Eingabe]

→ Welcome Screen:
  "Willkommen, {Name}! 🎉
   Dein Ziel: {Motivation[0]}
   Lass uns anfangen — deine finanzielle Freiheit wartet."
→ Button: "AllWin starten" → Dashboard
```

---

## 📊 SCREEN 2 — DASHBOARD

```
Header: "AllWin" Logo + aktueller Monat/Jahr + Saldo (grün/rot)

Cards:
1. MONATS-SALDO CARD
   - Einnahmen (grün) vs Ausgaben (rot)
   - Großer Saldo in der Mitte
   - "Du hast noch X € übrig diesen Monat"
   - Farbe: grün wenn Plus, rot wenn Minus

2. SCHULDEN CARD (nur wenn Schulden vorhanden)
   - Gesamtbetrag offen
   - Fortschrittsbalken pro Schuld
   - Wenn abgezahlt: 🏆 Celebration Animation

3. NOTGROSCHEN CARD
   - Aktueller Stand / Ziel (3x Gehalt)
   - Fortschrittsbalken
   - "Noch X € bis zum Ziel"

4. PORTFOLIO CARD (nur wenn Investment freigeschaltet)
   - Gesamtwert live
   - +/- Performance heute
   - Meilenstein Badges (1k, 5k, 10k, 25k, 50k, 100k)

5. JAHRESÜBERSICHT
   - Balkendiagramm alle 12 Monate
   - Grün = Plus, Rot = Minus
   - Jahressaldo gesamt
```

---

## 💸 SCREEN 3 — EINNAHMEN / AUSGABEN

```
Tab: [Einnahmen] [Ausgaben]

NEUE BUCHUNG FORM:
- Betrag (€)
- Datum (Standard: heute)
- Zahlungsart: Bar / Kreditkarte / Überweisung / Lastschrift
- Kategorie (mit Farbe):
  AUSGABEN: Essen & Trinken 🍔 | Fahrtkosten 🚗 | Abos 📱 | 
            Miete 🏠 | Kleidung 👕 | Gesundheit 💊 | 
            Freizeit 🎮 | Kredit Rate 💳 | Sonstiges
  EINNAHMEN: Gehalt | Freelance | Nebenjob | Sonstiges
- Notiz (optional)
- WICHTIG: "Kredit Rate" → automatisch in Schuldentracker übertragen!

LISTE:
- Chronologisch sortiert
- Farbige Kategorie-Badge
- Monatsabschluss: Monat wird "zugeklappt" als Tab
- Jahreswechsel: gleiches Prinzip

ÜBERSICHT:
- Kategorie-Auswertung (Tortendiagramm)
- Größter Ausgabeposten highlighted
```

---

## ⚡ SCREEN 4 — SCHULDEN TRACKER

```
ÜBERSICHT:
- Gesamtschulden offen (groß, orange)
- Diagramm: Schuldenabbau über Zeit

PRO SCHULD CARD:
- Name + Typ (Konsum/Haus)
- Restbetrag / Ursprungsbetrag
- Fortschrittsbalken (orange → grün)
- Monatliche Rate
- Zinssatz (wenn vorhanden)
- Button: "Rate zahlen" → Betrag reduzieren
- Geschätzte Schuldenfreiheit: "Noch X Monate"

WENN SCHULD = 0:
- 🏆 LEVEL UP Animation
- Konfetti
- "Herzlichen Glückwunsch! {Schuldenname} komplett abgezahlt!"
- "Möchtest du diese Rate jetzt investieren?" → direkt zur Investment Seite

WENN ALLE SCHULDEN = 0:
- Großes Celebration Screen
- "Du bist schuldenfrei! 🎉 Jetzt lass dein Geld für dich arbeiten!"
- → KI Investment Empfehlung *(Vision; im aktuellen Repo: Overlay/Feier ohne KI-Pflicht)*
```

---

## 📈 SCREEN 5 — INVESTMENT

```
PORTFOLIO ÜBERSICHT:
- Gesamtvermögen (live)
- Gesamtgewinn/-verlust in € und %
- Gesamtdiagramm (Linienchart, Entwicklung)

MEILENSTEIN BADGES:
🥉 Erste Investition
🥈 1.000 € investiert
🥇 5.000 € investiert  
💎 10.000 € investiert
👑 25.000 € investiert
🚀 50.000 € investiert
🏆 100.000 € investiert

PRO KATEGORIE (Aktien / Krypto / Immobilien):
- Eigener Tab
- Diagramm der Entwicklung
- Liste aller Assets
- Aktueller Kurs (live API)
- Kaufpreis vs. Aktuell → +/- %

KI EMPFEHLUNG (Claude API) — *Vision; Repo aktuell ohne KI-Integration*:
- Basierend auf: Saldo, Schulden, Risikoprofil, Alter
- Output: Monatliche Sparrate, Aufteilung in %, 5-Jahres-Ziel
- Button: "KI-Analyse starten"

ASSETS HINZUFÜGEN:
- Gleiche Maske wie Onboarding
- Jederzeit neue Aktien/Krypto/Immobilien hinzufügen
```

---

## 🌐 SCREEN 6 — MARKT

```
LIVE KURSE (alle 3 Sekunden update):
- BTC, ETH → CoinGecko API (kostenlos)
- Aktien → Alpha Vantage API oder Yahoo Finance
- MSCI World ETF

PRO ASSET:
- Symbol + Name + Icon
- Aktueller Preis
- 24h Änderung (grün/rot mit Pfeil)
- Mini Sparkline Chart

MARKT STIMMUNG:
- Fear & Greed Index
- Top Gewinner / Verlierer des Tages
```

---

## 👤 SCREEN 7 — PROFIL

```
PERSÖNLICHE DATEN:
- Avatar (Initialen)
- Email ändern
- Passwort ändern
- Benutzername ändern

ABONNEMENT:
- Aktueller Plan anzeigen
- Upgraden / Downgraden
- Zahlungsart ändern
- Kündigen

DEINE ERFOLGE:
- Alle Pokale / Orden anzeigen
- Gesperrt = grau, Erreicht = gold/farbig

SUPPORT:
- FAQs
- Support kontaktieren

EINSTELLUNGEN:
- Benachrichtigungen
- Währung
- Sprache
```

---

## ⚙️ SCREEN 8 — ALLGEMEIN (Footer/Settings)

```
- Impressum
- Datenschutz
- Rechtliche Grundlagen
- Keine Anlageberatung (Disclaimer) ⚠️
```

---

## 🎮 GAMIFICATION SYSTEM

```javascript
const ACHIEVEMENTS = [
  { id: "erste_buchung", title: "Erste Buchung!", icon: "📝", desc: "Du hast deine erste Transaktion eingetragen" },
  { id: "7_tage_streak", title: "7 Tage dabei!", icon: "🔥", desc: "7 Tage in Folge aktiv" },
  { id: "notgroschen_start", title: "Sicherheitsnetz", icon: "🛡️", desc: "Notgroschen aufgebaut begonnen" },
  { id: "notgroschen_voll", title: "Notgroschen voll!", icon: "💰", desc: "3 Monatsgehälter gespart" },
  { id: "schuld_1_frei", title: "Erste Schuld frei!", icon: "⛓️", desc: "Erste Schuld komplett abgezahlt" },
  { id: "schuldenfrei", title: "SCHULDENFREI!", icon: "🏆", desc: "Alle Schulden abgezahlt" },
  { id: "erste_investition", title: "Investor!", icon: "📈", desc: "Erste Investition getätigt" },
  { id: "1k_investiert", title: "1.000 € Club", icon: "🥉", desc: "1.000 € investiert" },
  { id: "10k_investiert", title: "10.000 € Club", icon: "💎", desc: "10.000 € investiert" },
  { id: "plus_monat", title: "Plus-Monat!", icon: "✅", desc: "Ersten Monat mit Plus abgeschlossen" },
  { id: "12_plus_monate", title: "Perfektes Jahr!", icon: "👑", desc: "12 Monate in Folge im Plus" },
];
```

---

## 🎨 DESIGN SYSTEM

```css
:root {
  /* Colors */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border: #30363d;
  
  --teal: #00d4aa;
  --teal-dark: #00a884;
  --teal-glow: #00d4aa22;
  
  --gold: #f8d03a;
  --gold-dark: #d4a017;
  
  --red: #e02020;
  --red-light: #ff7b7b;
  
  --orange: #f0883e;
  --purple: #a855f7;
  
  --text-primary: #e6edf3;
  --text-secondary: #7d8590;
  
  /* Typography */
  --font: 'DM Sans', sans-serif;
  
  /* Spacing */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  
  /* Shadows */
  --shadow-teal: 0 0 20px rgba(0, 212, 170, 0.2);
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
}
```

---

## 🔌 APIs & SERVICES

**Zielspec (Vision)** — im Repo aktuell anders umgesetzt:

```javascript
// 1. Krypto Live Kurse (kostenlos) — Vision
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

// 2. KI Empfehlungen — Vision (Anthropic); Repo: zuletzt entfernt, kein aktiver Endpunkt

// 3. Lokale Datenspeicherung — Vision: localStorage
//    Repo: localStorage für Token (`allwin.token`), Onboarding-Flag; User-State serverseitig users.json

// 4. Auth — Vision: Supabase/Firebase
//    Repo: eigenes Express + JWT-ähnliches Token + Google/Apple
```

**Ist (Repo):** Markt-Updates per **Timer/Random Walk** in `AllWin.tsx`; keine CoinGecko-Pflicht. Persistenz bei Login über **`PUT /api/user/state`**.

---

## 📋 CURSOR ANWEISUNGEN

Wenn du Cursor verwendest, **dieses Dokument** (`ALLWIN_CURSOR_PROMPT.md`) als Quelle nutzen:

```
Projekt: AllWin (Finanz-App, React).

1. Lies `docs/ALLWIN_CURSOR_PROMPT.md` vollständig (dieses Dokument).
2. Beachte zuerst den Abschnitt „IST-ZUSTAND REPOSITORY“ — dort steht, was im Repo wirklich existiert (`AllWin.tsx`, Billing, Money→Home, keine KI).
3. Die Abschnitte „PROJEKTSTRUKTUR“ / Screens / AppContext beschreiben die Ziel-Vision: Abgleichen, was schon da ist vs. was noch fehlt oder absichtlich abweicht.
4. Änderungen: lieber inkrementell, bestehende Patterns in AllWin.tsx und billingServer.js respektieren.

Regeln aus der Vision (weiterhin sinnvoll):
- UI-Sprache: Deutsch
- Dark Theme (#0d1117, #00d4aa)
- Mobile-first (~430px)
- DM Sans (Google Fonts) wo Styles greifen

Repo-spezifisch:
- Auth + State: Billing-Server und Vite-Proxy /api beachten
- Keine Gemini-/KI-Keys mehr erwarten, sofern nicht neu eingebaut
```

**Versionierung:** Dieses Dokument liegt im Repo unter **`docs/ALLWIN_CURSOR_PROMPT.md`**. Optional kann eine Kopie unter `Downloads/` o. ä. parallel gepflegt werden — dann bei Änderungen abstimmen.

---

## ✅ MVP CHECKLISTE

### Vision (Zielspec) — weiter offen / teilweise

- [ ] Projektstruktur wie Vision (`screens/`, `AppContext`) statt Monolith
- [ ] AppContext (State Management) wie spezifiziert
- [ ] Onboarding: alle 5 Steps exakt nach Spec (inkl. Investment-Freischaltlogik, Assets-Detail)
- [ ] Dashboard: Notgroschen-Kachel, Tortendiagramm Kategorien, … wie Spec
- [ ] Money: Tab Einnahmen/Ausgaben getrennt, Zahlungsart, Monatsklapp, Kreditrate → Schulden
- [ ] Investment Screen wie Vision (Meilensteine, KI, externe Kurse pro Asset)
- [ ] Markt: echte APIs (CoinGecko o. ä.)
- [ ] Profil: vollständig wie Spec (Avatar, E-Mail ändern, …)
- [ ] Gamification: Achievement-System wie Liste oben
- [ ] KI-Empfehlung (Claude o. ä.) — **aktuell nicht im Repo**
- [ ] PWA

### Repo — Stand (orientierend)

- [x] Vite + React + TS, Dark UI, Tabs (Home / Money / Boost / LevelUp / Mehr)
- [x] Onboarding (vereinfacht, in `AllWin.tsx`)
- [x] Dashboard (Monat aus Buchungen, Schulden, Portfolio-Kachel, Jahresbalken)
- [x] Money: Buchungen + Liste; Verknüpfung zu Home/Jahr
- [x] Boost: Schulden inkl. Archiv, Effekte
- [x] LevelUp: Portfolio + simulierter Markt + Paywall
- [x] Profil: Login, Google/Apple, Abo-Stripe-Flow (mit Env), Benachrichtigungen
- [x] Server-Persistenz `users.json` + `/api/user/state`
- [x] README von veralteten Gemini-Hinweisen befreien
- [ ] `Investments.tsx` einbinden oder mit LevelUp zusammenführen
- [ ] Externe Markt-APIs, PWA, volle Vision-Onboarding
