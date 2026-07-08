# House Hadadi

Phase 1 (Foundation) build from `house-hadadi-prd.md` — a shared dashboard for
food, cleaning, finance, tasks, and notepad, plus personal-calendar sync and
Israeli bank/credit-card import pulled forward from later phases. No AI
agents yet (Bayti / Telegram / meal-plan drafting are Phase 2+, see below).

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Auth + Realtime) · Tailwind ·
`googleapis` / `tsdav` for calendar sync · `israeli-bank-scrapers` for bank
sync.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` (creates all tables + RLS).
3. Go to **Authentication → Users → Add user** and create the two household
   accounts (Noam's and his wife's emails). Copy each user's UUID.
4. Open `supabase/seed.sql`, replace the two placeholder UUIDs
   (`11111111-...`, `22222222-...`) with the real ones from step 3, and the
   placeholder emails with the real ones. Run it in the SQL editor.
5. Enable **Email OTP** sign-in (on by default) — that's how the app signs
   people in (magic link, no passwords).

## 2. Environment variables

```
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
your Supabase project's **Settings → API**. Everything else is optional —
add it when you get to calendar/banking below.

## 3. Run it

```
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with one of the two seeded emails,
click the magic link. Repeat on your partner's phone/browser with the other
email — you're both looking at the same household data, live.

## 4. Deploy

Push this to a GitHub repo, then import it in Vercel (vercel.com/new) and
add the same env vars there. Vercel auto-deploys on every push. Install the
PWA from the deployed URL on both phones (Add to Home Screen / Install app).

## Auth model

Exactly two users, one household — enforced by Row Level Security
(`current_household_id()` in the schema), not by app logic. There's no
public sign-up; only the two accounts you create in Supabase can ever see
this household's data.

## Calendar integration

Each partner connects their **own** Google and/or Apple calendar from
**Settings** in the app. Once connected, any task with a due date (added
from the dashboard, or later from Telegram in Phase 2) is pushed as an event
onto the assignee's personal calendar — e.g. "walk Nala tomorrow at 8 -
Noam" shows up in the dashboard *and* on Noam's own calendar. We only ever
write events we created (tracked via `google_calendar_event_id` /
`apple_calendar_event_uid` on the task); we never read the rest of your
calendar.

**Google Calendar** needs its own OAuth client (separate from any Google
login you use elsewhere):
1. [Google Cloud Console](https://console.cloud.google.com) → new project →
   **APIs & Services → Library** → enable "Google Calendar API".
2. **APIs & Services → OAuth consent screen** → External → add both
   partners as test users (keeps it out of Google's review queue since
   it's just the two of you).
3. **Credentials → Create OAuth client ID** → Web application → add
   `http://localhost:3000/api/calendar/google/callback` (and your deployed
   URL's equivalent) as an authorized redirect URI.
4. Put the client ID/secret in `.env.local` as `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

**Apple Calendar** has no OAuth or REST API — CalDAV is the only
integration point. Each partner generates an
[app-specific password](https://appleid.apple.com) (Apple ID → Sign-In and
Security) and pastes it into Settings along with their iCloud email. Apple
also has no webhooks, so this is one-way (we push events; we don't watch
for changes made elsewhere).

## Banking integration (Israeli accounts)

Plaid doesn't cover Israeli institutions, so this uses
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers),
which logs into each bank/credit-card company's own site with a real
headless browser (there's no open-banking API in Israel to call instead).

That has two consequences for how this is wired up:

- **It never runs as a Vercel route.** A full Puppeteer + Chrome session
  doesn't fit serverless function time/size limits reliably. Instead it's
  two local scripts you run yourself (or put on a cron):
  ```
  npm run bank:add    # interactive — pick an institution, enter credentials
  npm run bank:sync   # pulls the last 14 days, reconciles against Finance
  ```
  To automate `bank:sync`, put it on a schedule *outside* Vercel — a
  GitHub Actions workflow with `cron`, a small always-on VPS, or even a
  `launchd`/`cron` job on a machine that's usually on. It needs
  `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role, keep this
  secret) and `BANK_CREDENTIALS_ENCRYPTION_KEY` in its environment.
- **Credentials never go through Claude or this chat.** `bank:add` runs on
  your own machine and writes straight to your own Supabase project,
  encrypted with a key that only lives in your env vars. Generate one with:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
  If an institution needs 2FA/OTP (the CLI will tell you), that flow isn't
  automated by the simple `bank:add` script — see israeli-bank-scrapers'
  own docs for the OTP variant.

Imported transactions land in `bank_transaction` and are reconciled against
your manually-logged `transaction` rows (matched by amount ±₪1 within a
3-day window). Unmatched ones are auto-created in Finance with
`source = 'bank_import'` and no category yet — they show up for you to
categorize, per the PRD's "reconciled against manual log" note.

## What's Phase 1 vs. later

**Built now:** all 6 dashboard sections with manual CRUD, realtime sync
across both phones, budget bars, PWA install, personal-calendar push for
tasks, Israeli bank/credit-card import + reconciliation.

**Deferred (see `house-hadadi-prd.md` sections 14–15 for the original
phasing):** Bayti the Telegram bot and all LLM classification/capture; Chef
agent's auto-drafted meal plans; Home agent's auto-nudges; receipt photo
parsing; Hebrew/RTL UI. The `agent_event` / `inbound_message` tables and the
`AgentProposalCard` component already exist so Phase 2 can plug straight in
without a schema migration.

## Known rough edges (fix before every day use)

- Settings shows 7 nav items on the mobile bottom bar — a bit cramped;
  worth moving Settings behind a menu once you're using this daily.
- Google Calendar timed events default to a 30-minute block; adjust
  `addMinutes(...)` in `lib/integrations/google-calendar.ts` if you want a
  different default duration.
- Budget category caps in `seed.sql` are placeholders (PRD Open Question
  #4) — set real numbers together before relying on the alerts.
