# Clever Finance — Öffentliche Testphase (Beta)

## Festgelegtes Startdatum

| | |
|---|---|
| **Öffentlicher Test-Start** | **Montag, 16. Juni 2026** |
| **Feedback-Frist (Tester)** | **Montag, 15. Juni 2026** |
| **Internes Review** | **Dienstag, 1. Juli 2026** |

Bis zum Start soll die App unter einer **öffentlichen URL** erreichbar sein — **ohne Bezahlung**, alle Funktionen freigeschaltet.

### Schritt 1 — Organisation (jetzt)

| Aufgabe | Datei / Link |
|---------|----------------|
| Tester-Liste pflegen | [BETA_TESTERS.md](./BETA_TESTERS.md) |
| Google Form anlegen (5 Fragen) | [BETA_FEEDBACK_FORM.md](./BETA_FEEDBACK_FORM.md) → Link unten eintragen |
| Einladungstext | steht in `BETA_TESTERS.md` (URLs erst nach Deploy einfügen) |

- [x] Mindestens **5 Tester** in der Tabelle eingetragen (Erdi, Jamila, Moritz, Tobias Jakobs, Tobias Ruf — alle iPhone)
- [x] Google Form erstellt, **Formular-URL** eingetragen
- [x] Git lokal: `git init` + Initial Commit (siehe [GITHUB_SETUP.md](./GITHUB_SETUP.md))
- [x] GitHub-Repo: [Grobhammer18/CleverFinance](https://github.com/Grobhammer18/CleverFinance) + `git push` ✅
- [x] Deploy live: Vercel + Railway (siehe URLs unten)
- [x] Smoke-Test iPhone (28.05.2026)
- [ ] Tester eingeladen ([BETA_TESTERS.md](./BETA_TESTERS.md))

---

## Ziele der Testphase

- Feedback von 5–15 Personen (Team + Bekannte)
- Verständlichkeit: Onboarding, App-Tour, Home, Money, Boost, LevelUp
- Stabilität mit echtem Login und Cloud-Sync (nicht nur localhost)
- **Kein Stripe / keine Abos** in dieser Phase

---

## URLs (live)

| Dienst | URL | Anmerkung |
|--------|-----|-----------|
| **App (Frontend)** | https://clever-finance.vercel.app | an Tester senden |
| **API (Billing + Auth)** | https://cleverfinance-production.up.railway.app | `APP_URL` = Vercel-URL, `AUTH_SECRET`, `PORT=8080` |
| **Feedback-Formular** | [Feedback CleverFinance](https://docs.google.com/forms/d/e/1FAIpQLSc0I-GQeqb7ND_EkofGvIYcUO44ZyMvllKOOYOLv6OakE3gwA/viewform) | ✅ |

**Einladungstext:** [BETA_TESTERS.md](./BETA_TESTERS.md)

---

## Terminal (lokal & Deploy)

Kurzreferenz zum Kopieren ins Terminal. Live-App: [clever-finance.vercel.app](https://clever-finance.vercel.app) · API: `https://cleverfinance-production.up.railway.app`

### Projekt öffnen

```bash
cd /Users/alwinruf/Downloads/All-Win-main
```

### Repo aktualisieren (nach Push von Cursor / anderem Rechner)

```bash
git pull origin main
git log -3 --oneline
```

### Lokal entwickeln — **zwei Terminals**

| Terminal | Befehl | Zweck |
|----------|--------|--------|
| **1** | `npm run dev:billing` | API Port **4242** (Login, `GET/PUT /api/user/state`) |
| **2** | `npm run dev` | App Port **3000** |

```bash
# Terminal 1
npm run dev:billing

# Terminal 2 (neues Fenster)
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000) · Money: [http://localhost:3000/#money](http://localhost:3000/#money) · Übersicht: [http://localhost:3000/#charts](http://localhost:3000/#charts)
- API-Health: `curl -s http://localhost:4242/api/health`

Ohne Terminal 1: Login/Sync lokal nicht vollständig testbar.

### Build prüfen (vor Push)

```bash
npm run lint
npm run build
```

### Änderungen live schicken (Vercel + Railway bauen automatisch)

```bash
git status
git add src/components/AllWin.tsx src/components/homeCharts/HomeChartsSection.tsx server/billingServer.js docs/
git commit -m "kurze Beschreibung auf Deutsch"
git push origin main
```

Nur App-UI:

```bash
git add src/components/AllWin.tsx src/components/homeCharts/
git commit -m "feat: …"
git push origin main
```

Nur API:

```bash
git add server/billingServer.js
git commit -m "fix: …"
git push origin main
```

### Production prüfen

```bash
# API läuft?
curl -s https://cleverfinance-production.up.railway.app/api/health

# Letzter Stand auf GitHub
git fetch origin && git log origin/main -1 --oneline
```

**Cloud-Sync (iPhone ↔ PC, E-Mail + Passwort):** Nach Deploy Railway (`a1a9edd`+): iPhone App öffnen → 5–10 s warten → App schließen → am PC anmelden. Speichern braucht CORS **`PUT`** auf der API.

### App-Stand (Commits, Mai 2026)

| Commit | Inhalt |
|--------|--------|
| `94dc2b0` | Money: Block **Einnahmen**; Übersicht: Kreis **Einnahmen nach Kategorie** |
| `a1a9edd` | **CORS PUT** — Cloud-Sync von Vercel |
| `19c89b1` | **Letzte Buchungen**: nach Monat/Datum, ältere Monate zugeklappt |
| `aae9637` | Buchungsdatum korrekt (nicht immer der 15.) |
| `832c289` | Buchungen bearbeiten/löschen |

### Lokal schnell testen (Money + Übersicht)

1. `npm run dev:billing` + `npm run dev`
2. Registrieren/Login
3. **Money** → Einnahme speichern → Abschnitt **„Einnahmen“** prüfen
4. Tab **Übersicht** → Donut **„Einnahmen nach Kategorie“**
5. Tab schließen / `git pull` auf zweitem Rechner → gleiche E-Mail → Daten da?

---

## Kostenlos für alle Tester

In der **Production-Build-Umgebung** (Vercel o. ä.) setzen:

```env
VITE_PUBLIC_BETA=1
```

Damit gilt in der App:

- Alle Features wie **Elite** (u. a. LevelUp / Live-Marktdaten)
- Unter **Mehr → Abo** Hinweis „Testphase — alles kostenlos“, **keine** Stripe-Checkout-Buttons
- Stripe-Keys auf dem Server **nicht** nötig für die Beta

Optional zusätzlich (redundant zu `VITE_PUBLIC_BETA`):

```env
VITE_DEV_FORCE_ELITE=1
```

---

## Deploy-Checkliste (bis **13. Juni 2026**)

### Frontend (Vercel) — erledigt

- [x] Repo GitHub, Build `dist`, Env `VITE_PUBLIC_BETA=1`, `VITE_BILLING_API_URL` → Railway
- [x] Registrierung + Onboarding + iPhone-Test

### Backend (Railway) — erledigt

- [x] Dockerfile, `node server/billingServer.js`, `PORT=8080`, CORS + `APP_URL`
- [ ] **Volume** `/app/server/data` (noch prüfen — sonst Accounts bei Redeploy weg)
- [x] Kein Stripe nötig in der Beta

### Vor / am 16.6.

- [x] Flow auf **öffentlicher URL** (Handy)
- [ ] Impressum mit echtem Kontakt
- [ ] **5 Tester eingeladen** → [BETA_TESTERS.md](./BETA_TESTERS.md)

---

## Go / No-Go am 15. Juni 2026 (Abend)

| Kriterium | Go |
|-----------|-----|
| App-URL lädt auf dem Handy | ✅ |
| Registrieren + Login + Sync (E-Mail/Passwort, iPhone ↔ PC) | ✅ (CORS PUT ab `a1a9edd`) |
| Onboarding + App-Tour | ✅ |
| Money → Home Saldo stimmt | ✅ |
| LevelUp ohne Paywall | ✅ |
| Kein versehentlicher Bezahl-Button sichtbar | ✅ |

Bei **No-Go**: Start um **eine Woche** auf **23. Juni 2026** verschieben und nur interne Tester einladen.

---

## Nach der Testphase

- Feedback auswerten (Top 3 Bugs, Top 3 UX-Themen)
- Entscheidung: Stripe aktivieren, Datum „Soft Launch“ mit echten Preisen
- `VITE_PUBLIC_BETA` entfernen oder auf `0` setzen

---

## Verwandte Docs

- [FEATURE_TESTING.md](./FEATURE_TESTING.md) — lokale Checkliste
- [ALLWIN_CURSOR_PROMPT.md](./ALLWIN_CURSOR_PROMPT.md) — Ist-Stand der App
