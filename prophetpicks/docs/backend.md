# ProphetPicks Backend

Personal-use sportsbook simulator backend. All routes are Vercel serverless
functions under `api/` and degrade gracefully to deterministic demo responses
when no provider credentials or database are configured.

## Routes

| Route          | Methods   | Purpose                                            |
| -------------- | --------- | -------------------------------------------------- |
| `/api/health`  | GET       | Reports which providers + Neon are wired (booleans only). |
| `/api/odds`    | GET       | Returns normalized odds quotes from The Odds API (NFL h2h / spread / total). Empty array when no key. |
| `/api/bets`    | GET, POST | Bet history. GET returns demo bets; POST acknowledges a new bet (id, savedAt). |
| `/api/slips`   | POST      | Persist a slip snapshot. Returns `{ slipId, savedAt, legCount }`. |
| `/api/live`    | GET       | Demo live game state (status clock + scores), keyed off the minute so consistent within ~60s. |

All routes return `{ source, ..., generatedAt }` so the frontend can badge the
active feed.

## Environment variables

Set these in Vercel (Project → Settings → Environment Variables) or in a
local `.env` for `vercel dev`. None are required for the app to function in
demo mode.

| Name                  | Used by                | Notes |
| --------------------- | ---------------------- | ----- |
| `ODDS_API_KEY`        | `/api/odds`, `/api/live` | The Odds API (https://the-odds-api.com). Free tier OK for personal use. |
| `APIFOOTBALL_KEY`     | scripts only           | Reserved for the legacy soccer sync job. |
| `SPORTRADAR_API_KEY`  | `/api/live` (future)   | Reserved. |
| `DATABASE_URL`        | `/api/bets`, `/api/slips` | Neon-flavored Postgres connection string. When unset, routes serve demo data and acknowledge writes in-memory only. |

All keys are server-side only. Never prefix with `VITE_`.

## Neon Postgres

1. Provision a Neon project in the Vercel Marketplace
   (`vercel marketplace add neon`).
2. Connect it to the ProphetPicks project — Vercel will set `DATABASE_URL`
   automatically.
3. Run the initial migration once:
   ```bash
   psql "$DATABASE_URL" -f migrations/0001_init.sql
   ```
4. Redeploy. `/api/health` will report `providers.neon: true`.

### Schema summary

- `prophetpicks_bets` — settled / pending mock bets.
- `prophetpicks_slips` + `prophetpicks_slip_legs` — saved slip snapshots.

See `migrations/0001_init.sql` for the full DDL.

## Roadmap

- Wire `@neondatabase/serverless` inside `/api/bets` and `/api/slips` (the
  routes already gate on `DATABASE_URL`, they just acknowledge today).
- Add `/api/live` SSE upgrade for real-time score push.
- Real-money payments — explicitly out of scope. ProphetPicks is a
  research/simulator tool; do not introduce wagering endpoints.
