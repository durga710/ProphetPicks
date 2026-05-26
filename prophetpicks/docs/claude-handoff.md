# ProphetPicks Claude Handoff

ProphetPicks is a personal-use sports parlay predictor and sportsbook simulator.

## Repo

- Workspace: `/Users/durgaghimeray/Documents/New project`
- App: `/Users/durgaghimeray/Documents/New project/prophetpicks`
- Branch: `codex/prophetpicks-design`
- Live URL: `https://prophetpicks.vercel.app/`
- Stack: React, Vite, TypeScript, Vercel

## Current State

The app has:

- ProphetPicks Pharaoh branding.
- Dense Betfair-style sportsbook layout.
- All-sports rail.
- Mock teams, markets, odds, slip, ledger, and bet history.
- Prophet Picks ranked predictor mode.
- Soccer API-Football adapter scaffolding.
- Provider-ready odds board work.
- Playwright E2E tests.
- Vercel deployment.

## Important Files

- Main UI: `src/components/LegacyBetfairApp.tsx`
- Betting/event data: `src/data/legacyBetfair.ts`
- Odds math: `src/domain/odds.ts`
- Soccer API adapter: `src/data/providers/apiFootball.ts`
- Styles: `src/index.css`
- UI tests: `tests/ui/app.test.tsx`
- E2E tests: `tests/e2e/sportsbook.spec.ts`

## Next Build Request

The user wants betting odds and everything implemented end to end in the app.

Recommended next work:

1. Keep improving the dedicated Odds Board nav screen.
2. Show dense sportsbook odds across all active games:
   - Moneyline or match result.
   - Spread or handicap.
   - Total.
   - Props where available.
   - Futures where applicable.
3. Every odds tile should show:
   - Decimal odds.
   - American odds.
   - Implied probability.
   - Market movement.
   - Source.
   - Updated timestamp.
4. Clicking an odds tile should add it to the existing betting slip.
5. Existing market screens should also show American odds and implied probability.
6. Keep API keys server-side only.
7. Use local fallback demo odds so the app works without credentials.
8. Add tests first for odds board rendering, filtering, and adding a tile to the slip.
9. Run validation:
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run test:e2e`

## Git Warning

There are unrelated untracked files in the workspace root outside `prophetpicks/`.
Do not stage or modify them unless the user explicitly asks.
