# ProphetPicks Reference-Informed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ProphetPicks as a private, probability-first sports parlay research dashboard informed by the Betfair reference app, without copying its unsafe credential handling or real-money betting execution.

**Architecture:** Start with an isolated product prototype and data model before implementing integrations. Use the Betfair reference repo only for conceptual patterns: market catalog ingestion, odds freshness checks, slip construction, and result journaling. ProphetPicks should separate data ingestion, prediction scoring, slip building, journal tracking, and UI presentation into clear modules.

**Tech Stack:** To be finalized after the product spec. Recommended direction is a modern TypeScript web app with a local-first database, a React/Next.js or Vite frontend, API modules for odds/data providers, and test coverage around odds math, stale-data validation, slip risk, and journal settlement.

---

## Files And Responsibilities

- `docs/prophetpicks/betfair-reference-analysis.md`: Reference findings and decisions extracted from the cloned Betfair app.
- `docs/superpowers/specs/2026-05-26-prophetpicks-design.md`: Product spec to write after final design approval.
- `docs/superpowers/plans/2026-05-26-prophetpicks-reference-informed-plan.md`: This reference-informed plan.
- Future `prophetpicks/` app directory: Product implementation, only after the spec is approved.
- Future `prophetpicks/src/domain/odds.ts`: Odds conversion, implied probability, payout math.
- Future `prophetpicks/src/domain/slip.ts`: Slip construction, duplicate-leg checks, correlation warnings, stale-odds validation.
- Future `prophetpicks/src/domain/prediction.ts`: Model score, fair probability, edge, confidence, model version.
- Future `prophetpicks/src/data/`: Data-source adapters and snapshot persistence.
- Future `prophetpicks/src/ui/`: Command Center screens and ProphetPicks design system.

## Phase 0: Finish Product Definition Before Code

### Task 1: Lock V1 Scope

**Files:**
- Modify: `docs/superpowers/specs/2026-05-26-prophetpicks-design.md`

- [ ] **Step 1: Decide first sport and market**

Record one v1 market family in the spec:

```markdown
## V1 Market Scope

ProphetPicks v1 focuses on exactly one market family chosen in the approval conversation before implementation begins.
All other sports and markets are out of scope for the first implementation.
If no market family has been chosen, implementation stops at this gate.
```

- [ ] **Step 2: Decide first data-source strategy**

Record whether v1 uses manual data import, API ingestion, Betfair, or another provider:

```markdown
## V1 Data Source

The first build uses exactly one data-source strategy chosen in the approval conversation before implementation begins.
Credentials are loaded from local environment variables only.
No provider secret is committed to the repository.
If no data-source strategy has been chosen, implementation stops at this gate.
```

- [ ] **Step 3: Decide v1 user model**

Record whether the first build is local/private only:

```markdown
## V1 User Model

ProphetPicks v1 is a private personal dashboard.
It does not support public users, deposits, withdrawals, or bet placement.
```

### Task 2: Lock Brand Direction

**Files:**
- Modify: `docs/superpowers/specs/2026-05-26-prophetpicks-design.md`

- [ ] **Step 1: Record the logo direction**

Add:

```markdown
## Brand Identity

Primary brand name: ProphetPicks.
Primary slogan: Find the edge before the slip.
Secondary trust line: Probability first. Parlays second.
Primary visual direction: pharaoh mask crest inspired by the provided mask reference, with navy-and-gold striping, gold face, and a simplified PP/crown small-size mark.
```

- [ ] **Step 2: Record app visual rules**

Add:

```markdown
## App Visual Rules

The dashboard uses the ProphetPicks mark quietly in the shell.
The full pharaoh mask appears in brand moments, empty states, share cards, and onboarding.
Core betting research screens prioritize dense tables, right-side slip rail, clear risk states, and readable numeric hierarchy.
```

## Phase 1: Build The Prototype Foundation

### Task 3: Create Project Skeleton

**Files:**
- Create: `prophetpicks/package.json`
- Create: `prophetpicks/src/`
- Create: `prophetpicks/tests/`

- [ ] **Step 1: Choose app stack after spec approval**

Use the stack selected in the approved design spec. Do not scaffold until the spec has been reviewed.

- [ ] **Step 2: Add a test command before feature code**

The first scaffold must include a working test command so odds math and slip validation are developed test-first.

### Task 4: Implement Domain Math First

**Files:**
- Create: `prophetpicks/src/domain/odds.ts`
- Create: `prophetpicks/tests/domain/odds.test.ts`

- [ ] **Step 1: Test American odds to implied probability**

Test examples:

```ts
expect(americanToImpliedProbability(-110)).toBeCloseTo(0.5238, 4);
expect(americanToImpliedProbability(150)).toBeCloseTo(0.4, 4);
```

- [ ] **Step 2: Test decimal odds conversion**

Test examples:

```ts
expect(decimalToImpliedProbability(2.5)).toBeCloseTo(0.4, 4);
expect(decimalToAmericanOdds(1.91)).toBeCloseTo(-110, 0);
```

- [ ] **Step 3: Test edge calculation**

Test examples:

```ts
expect(calculateEdge({ fairProbability: 0.58, impliedProbability: 0.52 })).toBeCloseTo(0.06, 4);
```

### Task 5: Implement Slip Validation

**Files:**
- Create: `prophetpicks/src/domain/slip.ts`
- Create: `prophetpicks/tests/domain/slip.test.ts`

- [ ] **Step 1: Test duplicate leg rejection**

Test examples:

```ts
const leg = { eventId: "evt_1", marketId: "mkt_1", selectionId: "sel_1" };
expect(validateSlip([leg, leg]).errors).toContain("Duplicate leg");
```

- [ ] **Step 2: Test stale odds warning**

Test examples:

```ts
expect(validateSlip([{ oddsUpdatedAt: "2026-05-26T12:00:00Z" }], { now: "2026-05-26T12:16:00Z" }).warnings).toContain("Stale odds");
```

- [ ] **Step 3: Test max-leg warning**

Test examples:

```ts
expect(validateSlip(makeLegs(7), { maxLegs: 5 }).warnings).toContain("Too many legs");
```

### Task 6: Implement Prediction Journal

**Files:**
- Create: `prophetpicks/src/domain/journal.ts`
- Create: `prophetpicks/tests/domain/journal.test.ts`

- [ ] **Step 1: Test saved prediction snapshot**

Test that each saved leg stores:

```ts
{
  oddsAtSelection: -110,
  impliedProbability: 0.5238,
  fairProbability: 0.58,
  edge: 0.0562,
  modelVersion: "rules-v1"
}
```

- [ ] **Step 2: Test settlement status**

Test status transitions:

```ts
UNKNOWN -> WON
UNKNOWN -> LOST
UNKNOWN -> VOID
```

### Task 7: Build Command Center UI

**Files:**
- Create: `prophetpicks/src/ui/TodayBoard.tsx`
- Create: `prophetpicks/src/ui/LegDetailDrawer.tsx`
- Create: `prophetpicks/src/ui/SlipRail.tsx`
- Create: `prophetpicks/src/ui/PredictionJournal.tsx`

- [ ] **Step 1: Build Today Board from fixture data**

Use fixture data before live integrations. The board must show sport, event, market, selection, odds, implied probability, fair probability, edge, confidence, and freshness.

- [ ] **Step 2: Build Leg Detail Drawer**

Drawer must explain why the leg appears:

```text
Model probability
Book implied probability
Estimated edge
Data freshness
Risk notes
```

- [ ] **Step 3: Build Slip Rail**

Slip rail must show:

```text
Selected legs
Combined odds
Estimated hit probability
Risk meter
Correlation warnings
Save to journal
```

## Phase 2: Add Data Integrations After Prototype Works

### Task 8: Choose A Real Data Adapter

**Files:**
- Create: `prophetpicks/src/data/providers/[provider].ts`
- Create: `prophetpicks/tests/data/providers/[provider].test.ts`

- [ ] **Step 1: Load provider credentials from environment**

No secrets may be hardcoded. Required environment names must be documented in the spec and `.env.example`.

- [ ] **Step 2: Normalize external data**

All providers must output internal ProphetPicks shapes:

```ts
Event
Market
Selection
OddsSnapshot
```

- [ ] **Step 3: Persist snapshots**

Odds updates are append-only snapshots so the app can compare selected price, current price, and closing price.

## Reference Safety Checklist

- [ ] Do not copy hardcoded credentials from the reference app.
- [ ] Do not implement deposits, withdrawals, or real-money bet placement in v1.
- [ ] Do not claim guaranteed wins.
- [ ] Do not recommend stale odds.
- [ ] Do not mix markets without correlation warnings.
- [ ] Do not use sportsbook or exchange APIs outside their terms.

## Self-Review

Spec coverage is incomplete until the user locks sport, data source, and local/private scope. This plan therefore defines a safe sequence and test-first boundaries, but it must be revised after the ProphetPicks design spec is approved.

No production implementation should begin until `docs/superpowers/specs/2026-05-26-prophetpicks-design.md` exists and is approved.
