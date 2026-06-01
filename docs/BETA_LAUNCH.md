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

Projektordner:

```bash
cd /Users/alwinruf/Downloads/All-Win-main
```

**Nach GitHub-Änderungen (z. B. von Cursor) — lokal aktualisieren:**

```bash
git pull origin main
```

**Lokal testen (zwei Terminals):**

```bash
# Terminal 1 — API (Auth + Cloud-Sync)
npm run dev:billing

# Terminal 2 — App
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) · Billing: [http://localhost:4242/api/health](http://localhost:4242/api/health)

**Änderungen live (Vercel + Railway deployen automatisch):**

```bash
git add src/components/AllWin.tsx server/billingServer.js
git commit -m "kurze Beschreibung"
git push origin main
```

**API / Cloud-Sync prüfen (Production):**

```bash
curl -s https://cleverfinance-production.up.railway.app/api/health
```

Stand **28.05.2026:** Cloud-Speichern (`PUT /api/user/state`) braucht CORS-Methode `PUT` auf Railway — Commit `a1a9edd`. Nach Deploy: iPhone App öffnen → kurz warten → App schließen → am PC unter [clever-finance.vercel.app](https://clever-finance.vercel.app) mit **E-Mail + Passwort** anmelden.

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
