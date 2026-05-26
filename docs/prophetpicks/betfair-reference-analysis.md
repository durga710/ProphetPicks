# ProphetPicks Betfair Reference Analysis

Source cloned to:

```text
references/Sport-Betting-APP-Betfair-Market
```

Source URL:

```text
https://github.com/rockscripts/Sport-Betting-APP-Betfair-Market
```

## What The Reference App Is

The cloned project is an older PHP/CodeIgniter sports betting web app built around the Betfair exchange API. It is not a modern predictor app, but it has useful reference patterns for market ingestion, event organization, runner/selection display, simple/combo bet slips, and settlement tracking.

The app is Spanish-language and uses a classic server-rendered architecture:

- CodeIgniter PHP controllers, models, and views.
- MySQL schema in `database.sql`.
- Betfair API dispatchers under `application/controllers/API/dispatcher`.
- Betfair data cache tables for competitions, events, market catalog, and runners.
- Session-backed betting layer for simple and combined bets.
- Cron-style jobs in `application/controllers/Jobs.php`.

## Useful Concepts For ProphetPicks

### Data Ingestion Loop

The reference app separates market ingestion into scheduled jobs:

- Import competitions.
- Import events by competition.
- Import market catalog by event.
- Refresh market books for current prices.
- Remove expired events.
- Update settled results.

ProphetPicks should keep this same conceptual pipeline, but modernize it:

- `sports` and `leagues` instead of Betfair-only competitions.
- `events` with normalized home/away participants and start times.
- `markets` with sportsbook/source-specific IDs.
- `selections` or `legs` with odds snapshots.
- `outcomes` and `settlements` for result tracking.
- `model_predictions` for probability, edge, confidence, and model version.

### Market Catalog Pattern

The reference app stores market metadata separately from live prices:

- `betfair_events`
- `betfair_market_catalog`
- `betfair_runners`

For ProphetPicks, that translates into:

- Keep event identity stable.
- Keep market identity stable.
- Treat odds as time-sensitive snapshots, not fixed properties.
- Track freshness in the UI and block stale recommendations.

### Slip Builder Pattern

The reference app has a `betting_layer` concept with:

- Simple vs combined bet mode.
- Add/remove selections.
- Stake and potential payout calculation.
- Price-change validation before placement.
- Expired-event validation before placement.

ProphetPicks should use the same user workflow, but as a research tool:

- Add/remove recommended legs.
- Show combined decimal/American odds.
- Show estimated hit probability.
- Show expected value.
- Show correlation warnings.
- Save the slip to a journal instead of placing real bets.

### Results And Journal Pattern

The reference app stores user bets and selections:

- `user_bettings`
- `user_bettings_selections`
- result values like `UNKNOWN`, `WINNER`, `LOSER`

ProphetPicks should adapt this into a prediction journal:

- Save selected legs with odds at selection time.
- Save model probability and edge at selection time.
- Save model version.
- Save result after settlement.
- Compare opening, selected, and closing odds when available.
- Track ROI only as an analysis metric, not a promise.

## What Not To Copy

### Do Not Copy The Security Model

The reference repo hardcodes Betfair credentials in:

```text
application/helpers/general_helper.php
```

ProphetPicks must never hardcode API keys, sportsbook credentials, passwords, tokens, or account details in source control. All data-source credentials must come from local environment variables or encrypted secret storage.

### Do Not Copy The Betting Execution Flow

The reference app has a real account/funds/bet placement mindset. ProphetPicks v1 should be personal decision support:

- No real-money placement.
- No deposits or withdrawals.
- No claim that a pick is guaranteed.
- No automatic betting.
- No bypassing sportsbook or data-provider terms.

### Do Not Copy The Old Frontend

The reference UI uses older jQuery-era modals, grid plugins, and server-rendered PHP views. Useful product ideas should be re-expressed in the ProphetPicks Command Center design:

- Today Board.
- Leg Detail Drawer.
- Slip/Risk Rail.
- Prediction Journal.
- Model Health.

## Reference-Informed Product Decisions

1. ProphetPicks should maintain a clean separation between market catalog data and odds snapshots.
2. ProphetPicks should treat stale odds as a first-class risk state.
3. ProphetPicks should validate every saved slip for expired events, stale prices, duplicate legs, and correlation risk.
4. ProphetPicks should journal predictions even when the user does not bet them.
5. ProphetPicks should start as a private research dashboard before adding public pick cards.
6. ProphetPicks should use the pharaoh mask brand as the visual identity, but keep app controls dense and data-first.

## Open Questions Before Implementation

1. First sport and market family: NBA props, NFL props/spreads, soccer match markets, or another lane.
2. First data source: manual CSV entry, odds API, Betfair exchange, sportsbook odds API, or a hybrid.
3. Whether v1 needs authentication or can be local/private only.
4. Whether the first build should be a static prototype, a local full-stack app, or an API-backed dashboard.
5. Whether model v1 should be rules-based edge scoring or historical-model backtesting.
