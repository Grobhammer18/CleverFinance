# Clever Finance — Öffentliche Testphase (Beta)

## Festgelegtes Startdatum

| | |
|---|---|
| **Öffentlicher Test-Start** | **Montag, 16. Juni 2026** |
| **Feedback-Frist (Tester)** | **Sonntag, 29. Juni 2026** |
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
- [ ] GitHub-Repo: [Grobhammer18/CleverFinance](https://github.com/Grobhammer18/CleverFinance) + `git push` (siehe unten)
- [ ] (App-URL kommt in Schritt 4/5 — Deploy)

---

## Ziele der Testphase

- Feedback von 5–15 Personen (Team + Bekannte)
- Verständlichkeit: Onboarding, App-Tour, Home, Money, Boost, LevelUp
- Stabilität mit echtem Login und Cloud-Sync (nicht nur localhost)
- **Kein Stripe / keine Abos** in dieser Phase

---

## URLs (eintragen, sobald deployt)

| Dienst | URL (Platzhalter) | Anmerkung |
|--------|-------------------|-----------|
| **App (Frontend)** | `https://________________.vercel.app` | Vite-Build, `VITE_BILLING_API_URL` zeigt auf Backend |
| **API (Billing + Auth)** | `https://________________.railway.app` | `server/billingServer.js`, Port aus Hosting |
| **Feedback-Formular** | [Feedback CleverFinance](https://docs.google.com/forms/d/e/1FAIpQLSc0I-GQeqb7ND_EkofGvIYcUO44ZyMvllKOOYOLv6OakE3gwA/viewform) | ✅ angelegt |

**Tester-Link (Copy-Paste):**

> Clever Finance — kostenlose Testphase: [APP-URL]  
> Bitte Konto anlegen, Onboarding + Tour durchklicken, 2–3 Buchungen in Money. Marktkurse sind Demo. Feedback bis 29.6.: [FORMULAR-URL]

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

### Frontend (z. B. Vercel)

- [ ] Repo mit GitHub verbinden
- [ ] Build: `npm run build`, Output: `dist`
- [ ] Env: `VITE_BILLING_API_URL=https://<API-HOST>` (ohne trailing slash)
- [ ] Env: `VITE_PUBLIC_BETA=1`
- [ ] Optional: `VITE_GOOGLE_CLIENT_ID` (falls Google-Login gewünscht)
- [ ] Test: Registrierung, Onboarding, Tour, eine Buchung

### Backend (z. B. Railway / Render / Fly.io)

- [ ] Start: `node server/billingServer.js` (siehe `package.json` → `dev:billing`)
- [ ] Env: `AUTH_SECRET=<starkes-geheimnis>`
- [ ] Env: `APP_URL=https://<FRONTEND-URL>` (für Redirects)
- [ ] Env: `BILLING_PORT` = vom Host gesetzter Port (oft `PORT`)
- [ ] Persistenz: Volume oder DB für `server/data/users.json` (sonst gehen Nutzer bei Redeploy verloren)
- [ ] CORS: Frontend-Origin erlauben (falls nötig in `billingServer.js` prüfen)
- [ ] **Keine** Stripe-Price-IDs nötig in der Beta

### Vor dem 16.6.

- [ ] Selbst 1× kompletten Flow auf der **öffentlichen URL** (Handy + Desktop)
- [ ] Impressum/Disclaimer: mindestens Platzhalter mit echtem Namen/Kontakt für externe Tester
- [ ] Tester-Liste + Einladungstext verschickt

---

## Go / No-Go am 15. Juni 2026 (Abend)

| Kriterium | Go |
|-----------|-----|
| App-URL lädt auf dem Handy | ✅ |
| Registrieren + Login + Sync | ✅ |
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
