# Prophet Picks Predictor Design

## Goal

Add a first-class Prophet Picks predictor workflow that turns the current sportsbook shell into a usable personal parlay builder. The feature ranks recommended mock picks, lets the user filter them, and sends selected picks into the existing betting slip.

## Scope

This slice stays fully client-side and mock-only. It does not call paid odds APIs, place live wagers, or claim real predictive accuracy. It creates a structured prediction catalog using the existing sports, events, markets, and slip flow.

## User Experience

The header gets a new `Prophet Picks` navigation item. Opening it shows a dense work surface with summary stats, filters, ranked pick cards, and a `Build Best Parlay` action.

Each pick shows:
- sport and matchup
- recommended market and selection
- decimal odds
- confidence grade
- model edge percentage
- risk tag
- concise reasoning
- `Add Pick` action

The user can filter by sport, confidence grade, and risk. `Add Pick` opens the existing slip with that selection. `Build Best Parlay` adds the top three high-confidence picks that can be resolved to real markets.

## Data Model

Create a `legacyPredictions` list in `src/data/legacyBetfair.ts`. Each prediction references an existing `eventId`, `marketId`, and `selectionId`, plus model metadata:
- `id`
- `rank`
- `confidence`
- `edge`
- `risk`
- `reason`

Resolver helpers convert prediction references into concrete event, market, and selection objects, so the UI does not duplicate market data.

## Behavior

The predictor screen must:
- render ranked picks by default
- show all sports represented in predictions
- filter without page reloads
- add one pick into the existing slip
- build a 3-leg combined slip from top picks
- display a useful empty state when filters remove everything

Slip calculations continue using existing editable stake and Simple/Combined logic.

## Testing

Add unit/UI tests for:
- predictor nav and default ranked cards
- sport/confidence/risk filters
- one-click `Add Pick`
- `Build Best Parlay`

Add E2E coverage for:
- opening `Prophet Picks`
- filtering picks
- adding a pick to the slip
- building a 3-leg parlay and seeing Combined mode with projected return

## Deployment

After local verification, commit, push `codex/prophetpicks-design`, deploy to Vercel production, and run E2E against `https://prophetpicks.vercel.app`.
