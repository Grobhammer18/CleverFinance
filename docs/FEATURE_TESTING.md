# AllWin — Features lokal testen

## Direktlink (Frontend)

Nach `npm run dev` im Projektroot:

**[http://localhost:3000](http://localhost:3000)**

(Vite startet mit `--host=0.0.0.0` — vom Handy im gleichen WLAN z. B. `http://<deine-lan-ip>:3000`.)

---

## Kurzablauf

| Schritt | Befehl / Aktion |
|--------|------------------|
| 1 | `npm install` (falls noch nicht) |
| 2 | `npm run dev` → Link oben öffnen |
| 3 | Optional: zweites Terminal `npm run dev:billing` + `.env.local` aus `.env.example` — dann **Login**, Sync, **Stripe/Pro** testbar |

---

## Onboarding erneut

- **Am schnellsten:** Tab **Home** → unter „Monat in Zahlen“ der Link **„Onboarding wiederholen“** (Toast, danach die 5 Schritte).
- **Alternativ:** Tab **Mehr** → Karte **„Onboarding“** → **„Onboarding erneut starten“**.
- **Noch nicht eingeloggt** (Login-Screen): unten **„Onboarding erneut ansehen“**.
- Ohne Backend bleibt es lokal; mit **`npm run dev:billing`** + Login wird `onboarding.done` nach kurzer Zeit wieder mitgeschickt (`PUT /api/user/state`).

## Tabs durchklicken

| Tab | Was testen |
|-----|----------------|
| **Home** | Monatssaldo, Einnahmen/Ausgaben (aus Money), Schulden-Kachel, Portfolio, Jahresbalken, Link „In Money bearbeiten“ |
| **Money** | Einnahme/Ausgabe speichern, Liste — danach **Home** neu prüfen (Summen) |
| **Boost** | Schulden anzeigen, Rate zahlen, Volltilgung, Archiv |
| **LevelUp** | Portfolio, Kauf/Verkauf; **Live-Markt** ohne Abo ggf. gesperrt (siehe unten) |
| **Mehr** | Login/Register, Google/Apple (nur mit Env), Profil, Abo-Hinweise |

---

## LevelUp / Live-Markt ohne Stripe

Ohne bezahltes Abo ist der Markt-Block hinter der Paywall.

**Option A — Dev wie Elite:** In `.env.local` z. B. `VITE_DEV_FORCE_ELITE=1` setzen, Dev-Server neu starten → Markt sichtbar.

**Option B — Echtes Abo:** Billing laufen lassen, Checkout im Profil durchspielen (Stripe-Testkeys in `.env.local`).

---

## Billing + Login (voller Pfad)

1. `.env.local` mit `AUTH_SECRET`, `VITE_BILLING_API_URL=http://localhost:4242`, ggf. Google/Apple/Stripe wie in **`README.md`**.
2. `npm run dev:billing`
3. `npm run dev` (anderes Terminal)
4. Unter **Mehr** registrieren / anmelden → State sollte nach Sync in `server/data/users.json` landen.

---

## Checkliste (abhacken)

- [ ] Home lädt, Saldo passt zu Money-Buchungen (gleicher Monat)
- [ ] Money: mindestens eine Einnahme + eine Ausgabe → Home aktualisiert
- [ ] Boost: Rate / Tilgen / Archiv
- [ ] LevelUp: Trade + Markt (mit Dev-Elite oder Abo)
- [ ] Mehr: Logout / wieder Login, ggf. OAuth wenn konfiguriert

Mehr Kontext für Cursor/Entwicklung: **[ALLWIN_CURSOR_PROMPT.md](./ALLWIN_CURSOR_PROMPT.md)**.

**Öffentliche Testphase (Datum, Deploy, kostenlos):** **[BETA_LAUNCH.md](./BETA_LAUNCH.md)**.
