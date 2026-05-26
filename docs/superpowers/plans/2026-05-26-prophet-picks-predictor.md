# Prophet Picks Predictor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-class Prophet Picks predictor screen that ranks mock picks and sends picks into the existing betting slip.

**Architecture:** Store mock prediction metadata in `src/data/legacyBetfair.ts`, resolve each prediction into existing event/market/selection objects, and render a new `Prophet Picks` screen inside `LegacyBetfairApp`. The screen uses existing stateful slip functions so picks and best parlays behave like all other mock selections.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, Vercel.

---

### Task 1: Prediction Data And Resolver

**Files:**
- Modify: `prophetpicks/src/data/legacyBetfair.ts`
- Test: `prophetpicks/tests/ui/app.test.tsx`

- [ ] **Step 1: Write failing UI expectations**

Add a test that opens `Prophet Picks` and expects ranked cards, confidence, edge, and an `Add Pick` button.

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/ui/app.test.tsx`

Expected: FAIL because `Prophet Picks` navigation does not exist.

- [ ] **Step 3: Add prediction types and data**

Add `LegacyPrediction`, `ResolvedPrediction`, `legacyPredictions`, and `getResolvedPredictions()`. Predictions must reference real event, market, and selection ids already returned by `getMarketsForEvent()`.

- [ ] **Step 4: Run targeted test**

Run: `npm test -- tests/ui/app.test.tsx`

Expected: still FAIL until the UI exists, but data imports compile.

### Task 2: Predictor Screen

**Files:**
- Modify: `prophetpicks/src/components/LegacyBetfairApp.tsx`
- Modify: `prophetpicks/src/index.css`
- Test: `prophetpicks/tests/ui/app.test.tsx`

- [ ] **Step 1: Add failing filter and add-to-slip tests**

Add tests for sport/confidence/risk filters, `Add Pick`, and `Build Best Parlay`.

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/ui/app.test.tsx`

Expected: FAIL because controls do not exist.

- [ ] **Step 3: Implement the screen**

Add `predictions` to `Screen`, a `Prophet Picks` nav button, `PredictionScreen`, filter state, pick cards, and callbacks:
- `addPrediction(prediction)` creates a slip item and opens the slip.
- `buildBestParlay(predictions)` clears or replaces the slip with the top three resolved predictions and sets Combined mode.

- [ ] **Step 4: Style the surface**

Add compact card/grid styling for predictor stats, filters, rank badges, confidence chips, and actions.

- [ ] **Step 5: Run UI tests**

Run: `npm test -- tests/ui/app.test.tsx`

Expected: PASS.

### Task 3: Browser Coverage And Release

**Files:**
- Modify: `prophetpicks/tests/e2e/sportsbook.spec.ts`

- [ ] **Step 1: Add E2E coverage**

Add a Playwright test that opens `Prophet Picks`, filters to NFL/A-grade picks, adds one pick, builds a best parlay, and confirms the slip contains three selections.

- [ ] **Step 2: Run E2E**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 3: Run full verification**

Run:
```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected: all commands pass.

- [ ] **Step 4: Commit, push, deploy, verify production**

Run:
```bash
git add docs/superpowers/specs/2026-05-26-prophet-picks-predictor-design.md docs/superpowers/plans/2026-05-26-prophet-picks-predictor.md prophetpicks/src/data/legacyBetfair.ts prophetpicks/src/components/LegacyBetfairApp.tsx prophetpicks/src/index.css prophetpicks/tests/ui/app.test.tsx prophetpicks/tests/e2e/sportsbook.spec.ts
git commit -m "feat: add prophet picks predictor"
git push origin codex/prophetpicks-design
cd prophetpicks && vercel --prod --yes
BASE_URL=https://prophetpicks.vercel.app npm run test:e2e
```

Expected: commit and push succeed, Vercel production deployment is Ready, live E2E passes.
