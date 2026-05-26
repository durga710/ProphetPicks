# ProphetPicks Design

## Objective

Build ProphetPicks as a private sports parlay research dashboard for personal use. The product should help evaluate legs, build risk-aware slips, and journal outcomes using probabilities, edge estimates, odds freshness, and clear reasoning.

ProphetPicks must not promise wins, automate real-money betting, or present picks as guaranteed outcomes.

## Brand

Name: ProphetPicks.

Primary slogan:

```text
Find the edge before the slip.
```

Secondary trust line:

```text
Probability first. Parlays second.
```

Core design principle:

```text
Every leg needs a reason.
```

The visual identity uses a pharaoh mask direction inspired by the provided reference image: gold face, navy-and-gold headdress striping, front-facing symmetry, and a ceremonial crest shape. The full mask crest should appear in brand moments, share cards, empty states, and onboarding. The app shell should use a smaller `PP` or crown-style mark so the dashboard stays data-first.

## V1 Product Shape

The recommended v1 is a Command Center dashboard:

- Left navigation for Today Board, Journal, Model Health, and Settings.
- Center market board for slate scanning.
- Right slip rail for selected legs, combined odds, hit probability, risk, and warnings.
- Detail drawer for each leg explaining the model, odds, confidence, and risk notes.

The initial product is a private research tool. It does not include public accounts, deposits, withdrawals, or bet placement.

## V1 Market Scope

ProphetPicks v1 uses NBA player props as the first demo market family and soccer match markets as the first multi-sport expansion. The app data model and UI labels should remain general enough to support player props, team markets, totals, and draw outcomes without forcing every leg to be player-specific.

## V1 Data Source

The first website uses local fixture data and manual-style snapshots. Soccer uses an API-Football-shaped adapter for fixtures and odds, with demo payloads normalized into ProphetPicks legs.

Live provider work must load secrets from environment variables and normalize provider output into ProphetPicks events, markets, selections, odds snapshots, and predictions. API-Football keys must stay server-side or in local sync jobs; they must not be exposed through `VITE_` browser environment variables.

### API-Football Soccer Source

Provider: API-Football by API-SPORTS.

Base URL:

```text
https://v3.football.api-sports.io
```

Authentication:

```text
x-apisports-key: <server-side key>
```

Initial endpoints:

- `/fixtures` for schedule, fixture IDs, teams, status, and kickoff time.
- `/odds?fixture=<id>` for bookmaker markets and prices.

Normalized v1 soccer markets:

- Match Result.
- Total Goals.
- Both Teams Score.

The frontend should consume normalized snapshots only. A backend, cron job, or local sync script should fetch API-Football data and write/cache normalized output.

## V1 User Model

ProphetPicks v1 is local/private. It supports saving research slips in the running browser session, but it does not include public accounts, payments, deposits, withdrawals, or real-money bet execution.

## Core Screens

### Today Board

The Today Board is the primary work surface. It shows available legs in a dense table with:

- Sport and league.
- Event and start time.
- Market and selection.
- Current odds.
- Implied probability.
- ProphetPicks fair probability.
- Estimated edge.
- Confidence.
- Data freshness.
- Add-to-slip action.

### Leg Detail Drawer

The detail drawer explains why a leg is on the board:

- Current odds and source.
- Book implied probability.
- Model fair probability.
- Estimated edge.
- Confidence rating.
- Recent data signals.
- Injury/news/context notes when available.
- Risk warnings.

### Slip Rail

The slip rail builds a parlay research slip:

- Selected legs.
- Combined odds.
- Estimated hit probability.
- Estimated EV.
- Max-leg warning.
- Duplicate-leg check.
- Stale-odds warning.
- Correlation warning.
- Save-to-journal action.

### Prediction Journal

The journal stores selected research slips and outcomes:

- Selected odds.
- Implied probability at selection time.
- Fair probability at selection time.
- Edge at selection time.
- Model version.
- Result: unknown, won, lost, void.
- Notes.
- Optional closing-line comparison.

### Model Health

Model Health shows whether ProphetPicks is behaving honestly:

- Calibration by confidence bucket.
- Hit rate by market.
- ROI by market as analysis only.
- Stale-data frequency.
- Markets to avoid.
- Model version history.

## Data Architecture

ProphetPicks should separate stable catalog data from live odds snapshots.

Recommended entities:

- `sports`
- `leagues`
- `events`
- `markets`
- `selections`
- `odds_snapshots`
- `model_predictions`
- `slips`
- `slip_legs`
- `journal_entries`
- `settlements`

The Betfair reference app confirms this separation is valuable: competitions/events/market catalog/runners are stable-ish catalog data, while market books and prices are time-sensitive.

## Data Flow

1. Ingest or import slate data.
2. Normalize teams, players, markets, selections, and timestamps.
3. Store odds as snapshots.
4. Run the probability and edge engine.
5. Rank legs for the Today Board.
6. Let the user build a slip.
7. Validate stale odds, duplicates, max legs, and correlation.
8. Save research slip to journal.
9. Settle results later and review model health.

## Error And Risk Handling

ProphetPicks must show explicit states for:

- Missing data source.
- Partial slate import failure.
- Stale odds.
- Expired events.
- Market unavailable.
- Duplicate leg.
- Overlong parlay.
- High correlation.
- Model unavailable.
- No current slate.

Stale odds should never be hidden. If data freshness is unknown, the UI should treat the leg as risky.

## Reference Repo Lessons

The cloned Betfair app is useful as a concept reference for:

- Scheduled market ingestion.
- Event and market catalog storage.
- Runner/selection display.
- Simple vs combined slip flow.
- Price-change checks before confirming.
- Expired-event checks.
- Result tracking.

Do not copy its unsafe patterns:

- Hardcoded credentials.
- Old PHP/jQuery frontend structure.
- Real-money deposits, withdrawals, and bet placement.
- Public gambling-platform flows.

## Frontend Design System

ProphetPicks should use:

- Dense tables for slate scanning.
- Drawer panels for reasoning.
- Right rail for slip building.
- Badges for freshness, edge, and confidence.
- Risk meters for parlay warnings.
- Tabs for journal/model views.
- Restrained charcoal, white, gold, navy, teal, red, and blue palette.

The app should feel like a serious analytics cockpit, not a hypey betting feed.

## Testing Strategy

Initial test coverage should focus on domain logic:

- American odds to implied probability.
- Decimal odds to implied probability.
- Edge calculation.
- Combined odds.
- Estimated slip hit probability.
- Duplicate-leg validation.
- Stale-odds validation.
- Max-leg warnings.
- Result settlement transitions.
- Journal snapshot integrity.

UI verification should confirm:

- Today Board renders with fixture data.
- Slip rail updates when legs are added or removed.
- Stale odds and correlation warnings are visible.
- Journal entries preserve prediction snapshots.

## Open Decisions

Before implementation begins, lock these choices:

- First sport and market family.
- First data-source strategy.
- Local-only app vs hosted private dashboard.
- Rules-based scoring vs historical backtesting for model v1.
