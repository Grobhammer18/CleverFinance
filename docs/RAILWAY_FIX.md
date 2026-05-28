# Railway zeigt weiße Seite / HTML statt API

## Symptom

`https://cleverfinance-production.up.railway.app/api/health` zeigt **weiß** oder die **App** — kein JSON.

→ Railway startet noch das **Vite-Frontend**, nicht `billingServer.js`.

## Fix (5 Min)

### 1. Code ist auf GitHub

Commit `fix: Railway API-only deploy (Dockerfile)` muss auf [CleverFinance](https://github.com/Grobhammer18/CleverFinance) sichtbar sein (`Dockerfile`, `railway.toml`, `nixpacks.toml`).

### 2. Railway Dashboard

1. Service **CleverFinance** öffnen  
2. **Settings** → **Build**  
3. **Builder:** **Dockerfile** wählen (nicht Nixpacks/Default)  
4. **Dockerfile path:** `Dockerfile`  
5. **Settings** → **Deploy** → **Start Command** (falls sichtbar):  
   `node server/billingServer.js`  
6. **Variables:** `AUTH_SECRET`, `PORT=8080`, `NODE_ENV=production`  
7. **Deployments** → **Redeploy** (oder warte auf Auto-Deploy nach GitHub-Push)

### 3. Logs prüfen

Nach Deploy in **View Logs** suchen:

```text
[billing] listening on http://localhost:8080
```

Wenn dort `vite` / `preview` steht → Builder noch falsch.

### 4. Test

Browser:

```text
https://cleverfinance-production.up.railway.app/api/health
```

**Richtig:** `{"ok":true,"service":"clever-finance-billing"}`  
**Falsch:** HTML / weiße App

### 5. Vercel

Wenn `/api/health` JSON zeigt:

- **https://clever-finance.vercel.app** → Registrieren testen  
- Railway: `APP_URL=https://clever-finance.vercel.app` → Redeploy
