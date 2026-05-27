# ProphetPicks Backend

Personal-use sportsbook simulator backend. All routes are Vercel serverless
functions under `api/` and degrade gracefully to deterministic demo responses
when no provider credentials or database are configured.

## Routes

| Route          | Methods   | Purpose                                            |
| -------------- | --------- | -------------------------------------------------- |
| `/api/health`  | GET       | Reports which providers + Neon are wired (booleans only). |
| `/api/odds`    | GET       | Pulls live NFL h2h / spread / total quotes from The Odds API when `ODDS_API_KEY` is set; soft-fails to `[]`. |
| `/api/bets`    | GET, POST | Bet history (Neon if `DATABASE_URL` set, demo otherwise). Upsert on POST. |
| `/api/slips`   | GET, POST | Slip persistence. POST writes both `prophetpicks_slips` and `prophetpicks_slip_legs` in sequence; GET returns the last 25. |
| `/api/live`    | GET       | Demo live game state (status clock + scores), minute-deterministic. |

All routes return `{ source, ..., generatedAt }` so the frontend can badge the
active feed.

## Environment variables

Set in Vercel (Project → Settings → Environment Variables) or in a local
`.env` for `vercel dev`. None are required for demo mode.

| Name                  | Used by                | Notes |
| --------------------- | ---------------------- | ----- |
| `ODDS_API_KEY`        | `/api/odds`            | [The Odds API](https://the-odds-api.com). Free tier (~500 calls/month) is enough for personal use. |
| `APIFOOTBALL_KEY`     | scripts only           | Used by `scripts/sync-soccer-fixtures.ts`. |
| `SPORTRADAR_API_KEY`  | `/api/live` (future)   | Reserved. |
| `DATABASE_URL`        | `/api/bets`, `/api/slips` | Neon Postgres connection string. When unset, routes serve demo data and acknowledge writes in-memory. |

All keys are server-side only. Never prefix with `VITE_`.

## One-step enables

### Light it up with The Odds API

```bash
# 1. Sign up at https://the-odds-api.com, grab your API key.
vercel env add ODDS_API_KEY production
# Paste the key when prompted.

vercel --prod
```

After redeploy, `/api/health` returns `providers.oddsApi: true` and the Odds
Board badge switches from "Showing demo book prices" to "The Odds API live
feed (updated HH:MM)".

### Light it up with Neon Postgres

```bash
# 1. Provision Neon through the Vercel Marketplace (sets DATABASE_URL).
vercel marketplace add neon

# 2. Apply the schema once.
psql "$DATABASE_URL" -f migrations/0001_init.sql

# 3. Redeploy.
vercel --prod
```

After redeploy, `/api/health` reports `providers.neon: true`. Every saved
bet and slip is now durable across deploys and sessions. `GET /api/slips`
returns the last 25 slips with their combined price computed in SQL.

## Schema summary

- `prophetpicks_bets` — settled / pending mock bets. Upserted on POST so the
  same `id` updates rather than dupes.
- `prophetpicks_slips` — slip headers (mode + stake_cents + saved_at).
- `prophetpicks_slip_legs` — composite PK `(slip_id, position)`, FK with
  cascade.

See `migrations/0001_init.sql` for the full DDL.

## Roadmap

- Server-Sent Events from `/api/live/stream` to replace 30s polling.
- Cross-session "My slips" page that reads `GET /api/slips`.
- Authenticated `user_handle` (currently every record is namespaced 'demo').
- Real-money payments — explicitly out of scope. ProphetPicks is a research
  / simulator tool; do not introduce wagering endpoints.
