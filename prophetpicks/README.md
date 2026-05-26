# ProphetPicks

Private sports parlay research dashboard for scanning edges, building slips, and journaling picks. It is a research tool, not a bet-placement app.

## Local App

```bash
npm install
npm run dev
```

The frontend uses local demo data for NBA props and API-Football-shaped soccer markets so the UI works without live credentials.

## Soccer API

ProphetPicks uses an API-Football adapter for soccer fixture and odds normalization. The API key must stay in local/server-side environment variables and must not be prefixed with `VITE_`.

```bash
cp .env.example .env
APIFOOTBALL_KEY=your_key_here npm run sync:soccer -- --league=39 --season=2025 --date=2026-03-07
```

The sync command writes normalized fixture JSON to `src/data/generated/soccer-fixtures.json`, which is ignored by git. Live odds should be fetched through a server-side job or backend proxy before being passed to the browser.

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:coverage
```
