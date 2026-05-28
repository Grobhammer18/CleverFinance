<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/11fbed9e-a93f-404b-9bd9-69081481f56b

**Product & Cursor context:** [docs/ALLWIN_CURSOR_PROMPT.md](docs/ALLWIN_CURSOR_PROMPT.md) — Zielspec + Ist-Stand des Repos.

**Features lokal testen:** [docs/FEATURE_TESTING.md](docs/FEATURE_TESTING.md) — Link `http://localhost:3000` + Checkliste.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Optional: copy `.env.example` to `.env.local` and set billing/auth vars if you use login + sync.
3. Run the app:
   `npm run dev`

## Optional: Stripe subscriptions (Pro/Elite)

1. Install dependencies:
   `npm install`
2. Add these values to `.env.local`:
   - `APP_URL=http://localhost:3000`
   - `BILLING_PORT=4242`
   - `VITE_BILLING_API_URL=http://localhost:4242`
   - `AUTH_SECRET=please-change-this`
   - `GOOGLE_CLIENT_ID=...`
   - `VITE_GOOGLE_CLIENT_ID=...`
   - `APPLE_CLIENT_ID=...`
   - `VITE_APPLE_CLIENT_ID=...`
   - `VITE_APPLE_REDIRECT_URI=http://localhost:3000`
   - `STRIPE_SECRET_KEY=...`
   - `STRIPE_WEBHOOK_SECRET=...` (optional for local webhook testing)
   - `STRIPE_PRICE_PRO_MONTHLY=price_...`
   - `STRIPE_PRICE_PRO_YEARLY=price_...`
   - `STRIPE_PRICE_ELITE_MONTHLY=price_...`
   - `STRIPE_PRICE_ELITE_YEARLY=price_...`
3. Start billing server:
   `npm run dev:billing`
4. In a second terminal, start app:
   `npm run dev`

## Login + persistent user data

- The billing server now also provides auth endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/oauth/google`
  - `POST /api/auth/oauth/apple`
  - `GET /api/auth/me`
  - `GET/PUT /api/user/state`
- User data is persisted in `server/data/users.json`.

### Apple Login checklist (local)
- Make sure Apple Service ID matches:
  - `APPLE_CLIENT_ID` and `VITE_APPLE_CLIENT_ID`
- Add your local redirect URI in Apple Developer:
  - `http://localhost:3000` (or your active local port)
- Restart both servers after env changes.
