# Schritt 2 — GitHub (Clever Finance)

Repo für **Vercel** (Frontend) und **Railway** (API) vorbereiten.

---

## Was bereits lokal erledigt werden kann

```bash
cd /Users/alwinruf/Downloads/All-Win-main
git init
git add .
git commit -m "Initial commit: Clever Finance Beta"
```

`.gitignore` schließt u. a. aus: `node_modules/`, `dist/`, `.env*`, `server/data/users.json`.

---

## GitHub-Repository anlegen

### Option A — Website (empfohlen, wenn du `gh` nicht nutzt)

1. [github.com/new](https://github.com/new) öffnen
2. **Repository name:** z. B. `clever-finance` (oder `All-Win`)
3. **Private** empfohlen (Beta, noch nicht öffentlich)
4. **Kein** README / .gitignore / License hinzufügen (haben wir schon)
5. **Create repository**

Dann im Terminal (URL von GitHub ersetzen):

```bash
cd /Users/alwinruf/Downloads/All-Win-main
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/clever-finance.git
git push -u origin main
```

Bei HTTPS fragt GitHub nach Login (Browser oder Personal Access Token).

### Option B — GitHub CLI

```bash
gh auth login
cd /Users/alwinruf/Downloads/All-Win-main
gh repo create clever-finance --private --source=. --remote=origin --push
```

---

## Nach dem Push

- [ ] Auf GitHub: Repo sichtbar, Dateien da (ohne `.env.local`, ohne `users.json`)
- [ ] Weiter mit **Schritt 4/5 Deploy** in [BETA_LAUNCH.md](./BETA_LAUNCH.md) (Vercel + Railway)

### Vercel (kurz)

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub-Repo importieren
2. Framework: **Vite** (auto)
3. Environment Variables:
   - `VITE_PUBLIC_BETA` = `1`
   - `VITE_BILLING_API_URL` = *(Railway-URL, erst nach Backend)*
4. Deploy

### Railway (kurz)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Root: Repo, Start: `node server/billingServer.js`
3. Variables: `AUTH_SECRET`, `APP_URL` (Vercel-URL), `PORT` vom Host
4. Volume: `server/data` für persistente Accounts

---

## Checkliste Schritt 2

- [ ] `git init` + erster Commit lokal
- [ ] GitHub-Repo erstellt (privat)
- [ ] `git push` erfolgreich
- [ ] Vercel mit Repo verbunden *(Deploy folgt in Schritt 5)*
