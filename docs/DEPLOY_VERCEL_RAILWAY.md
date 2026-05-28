# Deploy — Vercel + Railway (öffentliche Beta-URL)

Repo: [Grobhammer18/CleverFinance](https://github.com/Grobhammer18/CleverFinance)

**Reihenfolge:** zuerst **Railway** (API), dann **Vercel** (App mit API-URL).

> **Wichtig:** `https://cleverfinance-production.up.railway.app` ist **nur die API**, keine App-URL für Tester.  
> Im Browser dort nur testen: `/api/auth/me` — **nicht** `#home` nutzen.  
> Die App öffnest du auf der **Vercel-URL** (z. B. `….vercel.app`).

---

## 1. Railway — Backend (Auth + Sync)

1. [railway.app](https://railway.app) → Login mit GitHub
2. **New Project** → **Deploy from GitHub repo** → **CleverFinance**
3. Service-Einstellungen:
   - **Start Command:** `node server/billingServer.js`
   - Root bleibt Repo-Root (Standard)

4. **Variables** (Tab Variables):

| Variable | Wert |
|----------|------|
| `AUTH_SECRET` | langes Zufallspasswort (z. B. 32+ Zeichen) |
| `APP_URL` | *(erst nach Vercel eintragen — Vercel-URL)* |
| `NODE_ENV` | `production` |

`PORT` setzt Railway automatisch — der Server nutzt `process.env.PORT`.

5. **Volume** (wichtig für Accounts):
   - Volume an Service hängen
   - Mount Path: `/app/server/data` (oder Pfad laut Railway-Root — oft `/app/server/data`)

6. **Deploy** abwarten → **Public URL** kopieren, z. B.  
   `https://cleverfinance-production.up.railway.app`

7. Kurztest im Browser:  
   `https://DEINE-API-URL/api/health` → muss **`{"ok":true,...}`** sein (JSON).  
   Wenn **HTML** / die App erscheint: Railway startet noch das Frontend — **Dockerfile**-Deploy (siehe `Dockerfile` im Repo) + Redeploy.

---

## 2. Vercel — Frontend (App)

1. [vercel.com](https://vercel.com) → Login mit GitHub
2. **Add New… → Project** → Import **CleverFinance**
3. Framework: **Vite** (wird erkannt)
4. **Environment Variables** (Production):

| Name | Wert |
|------|------|
| `VITE_PUBLIC_BETA` | `1` |
| `VITE_BILLING_API_URL` | Railway-URL **ohne** Slash am Ende |

5. **Deploy**

6. Vercel-URL notieren, z. B. `https://clever-finance.vercel.app`

---

## 3. Railway nochmal — `APP_URL` setzen

In Railway Variables:

```
APP_URL=https://deine-app.vercel.app
```

→ **Redeploy** (oder Restart Service).

Optional, falls CORS-Probleme:

```
CORS_ORIGIN=https://deine-app.vercel.app
```

(`APP_URL` reicht normalerweise — der Server übernimmt die Origin automatisch.)

---

## 4. Test auf dem iPhone (wie eure Tester)

1. Safari → Vercel-URL öffnen
2. **Registrieren** → Onboarding → App-Tour
3. Money: Buchung → Home prüfen
4. LevelUp: ohne Paywall

URLs eintragen in:

- [BETA_LAUNCH.md](./BETA_LAUNCH.md)
- [BETA_TESTERS.md](./BETA_TESTERS.md)

---

## 5. Beta — kein Stripe

Stripe-Variablen **weglassen**. `VITE_PUBLIC_BETA=1` = alles frei, keine Checkout-Buttons.

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Login geht nicht | `VITE_BILLING_API_URL` prüfen; Railway läuft; `APP_URL` = Vercel-URL |
| CORS-Fehler in Safari-Konsole | `APP_URL` exakt wie Vercel-URL (https, kein `/` am Ende) |
| Accounts weg nach Deploy | Volume auf `server/data` |
| Leere Seite | Vercel Build-Log; lokal `npm run build` |
