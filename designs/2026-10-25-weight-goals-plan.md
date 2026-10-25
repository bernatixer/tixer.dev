# Weight Goals Implementation Plan

> **For agentic workers:** Implement the independent Worker API, pure calculation model, and local-data preparation tasks in parallel, then integrate the UI and run one whole-change review. Steps use checkbox syntax for tracking.

**Goal:** Ship the approved Weight design and open a local preview populated with the user's production weight and food records when access permits.

**Architecture:** Keep independent Focus and Worker apps and their existing libraries. Add explicit profile, goal and food-review records; use pure calculations for estimates and forecasts. Reuse the local signed-token preview server with a persistent, local-only SQLite database.

**Tech Stack:** React 18, TypeScript, Hono, Cloudflare D1, Node SQLite, Vite, pnpm.

**Spec:** `designs/2026-10-25-weight-goals.md`.

## Global Constraints

- No dependencies, production writes, pushes, deployment, changes to landing output, or shared theme extraction.
- Goals concern the seven-day average; reaching requires four readings and a reading on the evaluation day.
- Calibration requires 28 reviewed food days, aligned boundary weights and at least 14 weigh-ins. Never replace missing food with planned calories.
- Recalculation requires acceptance; existing phases retain their dates and protein settings.
- Forecasts use the existing approximate 7,700 kcal/kg and account for averaging lag and already scheduled phases.
- Production reads are authorized by the user's request to copy their data locally; copy only the relevant user's weight and meal records, keep exports outside Git, and do not copy service secrets into the preview database.

## Review Focus

- Concurrent meal changes must invalidate review confirmation atomically, including Telegram undo and stale review requests.
- Historical food days without weigh-ins, empty reviewed days, and dates older than 35 days remain editable.
- Goals close to the deadline and future scheduled phases must yield a feasible averaged target or an explicit failure.
- Failed saves and drawer navigation must retain unfinished input and return keyboard focus.
- Local preview must bind to loopback, use only the local database, and retain changes after a restart.

## Shared Interfaces

`WeightProfile = { age: number; heightCm: number; sex: 'male' | 'female'; activityFactor: number }`.

`WeightGoal = { startDate: string; startWeightKg: number; targetDate: string; targetWeightKg: number }`.

`FoodDay = { date: string; kcal: number | null; mealCount: number; revision: number; confirmedRevision: number | null }`.

`GET /weight` adds `profile: WeightProfile | null`, `goals: WeightGoal[]`, and `days: FoodDay[]` alongside existing `entries`, `phases`, and recent `meals`.

`GET /weight/days/:date` returns `{ date, meals, revision, confirmedRevision }`.

`PUT /weight/profile` accepts the profile. `PUT /weight/goals/:date` accepts `{ targetDate, targetWeightKg }` and computes the saved starting average server-side.

`PUT /weight/day-reviews` accepts `{ days: { date, revision }[], complete: boolean, timeZone?: string }`; stale revisions return 409 without partially confirming the range.

`POST /meals` supports `{ date, description, kcal }` for manual food without quota use, alongside the existing estimator request.

## Task 1 Worker persistence and API

**Files:** `worker/schema.sql`, `worker/src/handlers/weight.ts`, `worker/src/handlers/meals.ts`, `worker/src/handlers/telegram.ts`, `worker/src/index.ts`, `worker/tests/weight.test.ts`, `worker/tests/telegram.test.ts`; a small meal storage helper is allowed if needed to avoid circular imports.

- [x] Add failing API tests for profiles, versioned goals, historical day summaries/details, manual food, stale/atomic review confirmation, and meal invalidation across web and Telegram.
- [x] Run `cd worker && pnpm test` and observe the new behaviour fail.
- [x] Add idempotent profile, goal and food-day review tables and user-scoped endpoints. Keep existing auth, quota and nutrient-scaling behaviour.
- [x] Run `cd worker && pnpm test && pnpm typecheck`; expect all tests and types to pass.

## Task 2 Pure calculation model

**Files:** `focus/src/weight/model.ts`, new `focus/src/weight/goals.ts`, `focus/tests/weight.test.ts`, new `focus/tests/weight-goals.test.ts`.

- [x] Write failing tests for initial expenditure, sparse goal completion, fixed goal versions, aligned reviewed-food calibration, zero/missing food, averaged forecast solving, expired goals, and scheduled phases.
- [x] Run `cd focus && node --experimental-strip-types --test tests/weight*.test.ts`; expect failures for the missing behaviour.
- [x] Export the shared types above from `model.ts`. Implement `profileExpenditure`, `observedExpenditure`, `goalOn`, `goalReference`, `goalProgress`, `forecast` and `suggestPhase` in `goals.ts`; document exact exported return types for UI integration. Remove the planned-intake fallback from observed maintenance.
- [x] Run the focused tests, then `cd focus && pnpm test`; expect passing tests.

## Task 3 Local preview and real data

**Files:** `worker/tests/sqlite.ts`, `worker/tests/browser-server.ts`, and optional small preview seed utility under `worker/tests/`. Production data stays in an ignored local directory.

- [x] Verify existing local preview and determine read-only Cloudflare access without logging credentials.
- [x] Identify the user's records from table ownership/counts; export only relevant weight entries, phases and meals using SELECT queries. If several plausible owners exist, ask which account while continuing implementation.
- [x] Let the preview database persist to an explicit local path, seed records under its synthetic authenticated user, and bind the server to loopback. Do not seed Telegram chat identifiers, secrets or unrelated users.
- [x] Verify counts and representative dates without printing meal descriptions, restart persistence, and confirm that API writes affect only local storage.

## Task 4 Focus UI integration

**Files:** `focus/src/weight/WeightApp.tsx`, `focus/src/weight/weight.css`; add `WeightPlan.tsx`, `DayDrawer.tsx`, and a small native dialog shell if the current file would otherwise mix independent flows.

- [x] Add a browser regression covering goal/profile saving, manual food on a past date, day review, phase proposal acceptance, save failure and drawer focus. Run against the old UI to verify the missing behaviour.
- [x] Integrate fixed goal, distinct forecast and observed expenditure in stats/chart/history. Keep existing weigh-in, meal estimator, phase editing and Telegram controls.
- [x] Add the goal/profile/recalculate flow and accepted phase proposal, range review, all-date daily summaries, and an editable drawer using the existing Finance styles and native dialog behaviour.
- [x] Run browser checks at desktop and phone widths, Focus tests/build, and Worker tests/typecheck. Fix user-visible failures before final review.

## Task 5 Review and handoff

- [x] Have a fresh reviewer examine the final connected code against the spec, emphasizing the Review Focus cases.
- [x] Fix important findings and run the affected tests and final suites.
- [x] Open the local Weight URL in the user's browser and leave both local services running. Report the URL, copied record counts, verification, and any concrete limitation.

## Verification results

Focus: 117 tests pass and production build passes. Worker: 42 tests pass and typecheck passes. Browser regression covers goal/profile saving, phase acceptance, historical manual food, food review, unknown intake, failed writes, retained calorie corrections, successful writes followed by failed refreshes, deadline outcomes, mobile sizing and focus return.

Fresh review findings about unknown historical totals, successful-write refresh failures, partial nutrients and expired-goal results were reproduced and resolved. Retired goal and maintenance calculations were removed after the new model and UI passed.

The private local preview contains 10 production weigh-ins, 1 phase and 43 meals under a synthetic local user. Original dates and nutrients are preserved; no profile, goal or review confirmation was invented. Production access was SELECT-only. Local edits persist in a private database outside the repository.

The app runs at http://localhost:3000/weight with a loopback API on port 5556. Restart the API from `worker/` using `FOCUS_PREVIEW_DB=/Users/bernat.t/Library/Caches/tixer-weight-preview/preview.sqlite FINANCE_TEST_PORT=5556 node --env-file=.dev.vars tests/serve.mjs`; restart Focus from `focus/` using `FOCUS_LOCAL_PREVIEW=1 VITE_API_URL=http://localhost:5556/api pnpm dev --host 127.0.0.1`. The local environment provides the existing meal-estimator key; the imported database contains no secrets or Telegram links.
