# Creator-Dashboard (Analytics, Feedback, Affiliates)

Als Betreiber siehst du Nutzung, Feedback und Affiliate-Codes in einem einfachen Web-Panel — ohne separates Admin-Tool.

## Was wird erfasst?

| Bereich | Inhalt |
|--------|--------|
| **Nutzer** | Anzahl, Registrierungen (letzte 30 Tage), Liste mit E-Mail/Name |
| **Nutzung** | Aktive Nutzer (7 Tage), geschätzte **Minuten** (Ping alle 60 s ≈ 1 Minute), letzter Tab |
| **Feedback** | Alles aus „Mehr → Feedback & Wünsche“ (Kategorie + Text) |
| **Affiliate (Phase 1)** | Codes anlegen, Referrals zählen bei Registrierung mit `?ref=CODE` |

Datenbank: **SQLite** (`server/data/clever.db`). Beim ersten Start werden bestehende `users.json` / `feedback.json` importiert (Backup bleibt).

## Lokal starten

```bash
# Terminal 1 — API
ADMIN_SECRET=dein-geheimes-passwort npm run dev:billing

# Terminal 2 — App
npm run dev
```

Dashboard: **http://localhost:4242/creator**  
Passwort = Wert von `ADMIN_SECRET`.

## Railway (Production)

1. **Variables** im Railway-Service:
   - `ADMIN_SECRET` — starkes Passwort, nur für dich
   - optional `DATABASE_PATH=server/data/clever.db`
2. **Volume** auf `server/data` mounten (wie bisher für `users.json`), damit die DB über Deploys bleibt.
3. Öffnen: `https://cleverfinance-production.up.railway.app/creator`

## Affiliate-Links

1. Im Dashboard unter **Affiliates** einen Code anlegen (z. B. `BETA2026`).
2. Link teilen: `https://clever-finance.vercel.app/?ref=BETA2026`
3. Bei **neuer Registrierung** (E-Mail) wird der Code gespeichert und im Dashboard gezählt.

Auszahlungen / Provisionen sind **noch nicht** implementiert — nur Tracking.

## API (nur mit Admin-Token)

Nach Login im Dashboard liegt der Token im Browser (`localStorage`). Header:

`Authorization: Admin <token>`

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/feedback`
- `GET /api/admin/affiliates`
- `POST /api/admin/affiliates` — Body: `{ "code", "label", "note" }`

## Datenschutz

- Dashboard nur mit `ADMIN_SECRET`, nicht öffentlich verlinken.
- `clever.db` steht in `.gitignore` — nie ins Repo committen.
