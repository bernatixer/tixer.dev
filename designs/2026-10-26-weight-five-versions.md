# Five local Weight workflows

Build five working local variants sharing the real-data snapshot and common fixes. No production writes, deployment, new dependencies, or replacement of the user's original local records.

1. North star: one fixed weight/date target; current trend and observed energy balance; no calorie phases.
2. Goal phases: dated weight/date goals define fixed target lines; starting a phase changes the destination without rewriting earlier lines.
3. Checkpoints: a fixed destination with editable intermediate weight/date checkpoints.
4. Calorie target: a chosen daily intake alongside the weight/date destination; saved calorie targets are manual, never suggested or automatically applied.
5. Reality forecast: fixed destination versus the current seven-day trend and a short conditional projection from observed pace.

Shared fixes: human dates; food-only day drawer; weight editing in history; compact profile with sex buttons; multiple weekly sports; explicit inclusion of running in steps; observed burn from available aligned food/weight intervals with early-data labels; chart calories toggle and separate kcal scale. Preserve asynchronous meal submissions, retry semantics, drawer dismissal/draft guards, and latest-read-wins refreshes.

## Contracts and ownership

`concepts.ts`: WeightConceptId = north-star | goal-phases | checkpoints | calorie-target | reality-forecast. GoalCheckpoint = {date, weightKg}. WeightPage accepts optional concept; absent defaults to goal-phases. WeightPlan receives concept, checkpoints, onCheckpointsChange in addition to existing props. It owns goal/profile/calorie editors. Root owns checkpoint persistence and chart.

Profile additions: Workout = {sport: strength|cycling|running|swimming, minutesPerSession, sessionsPerWeek}; WeightProfile adds workouts?: Workout[]|null and stepsIncludeRuns?: boolean|null. Older one-sport fields remain readable until saved. Worker stores the additions in a new table, not ALTER. A running step inclusion choice prevents double counting.

Model helpers: trendAt(entries,date) returns number|null for the preceding seven calendar days; observedExpenditure uses known food on every day of an aligned interval of 1–28 days, with two boundary weigh-ins minimum. Missing food stays unknown. It exposes averageIntakeKcal and kgPerWeek. Short windows are explicitly provisional. Goal references remain independent of actual readings after creation.

A development-only comparison entry authenticates five validated synthetic owners on the existing preview API. Each owner is seeded once from the original local owner. Meals get distinct IDs and no Telegram data. Existing records and variant edits survive restart. The comparison gallery and five views are outside production entry points.

## Verification

Unit checks cover workout sums, step overlap, available-data burn, fixed goal lines, checkpoints, dates and data isolation. Browser checks cover all five workflows, profile persistence, graph calories, food-only drawer, inline weight editing and concurrent meal jobs. Inspect desktop and phone layouts. Run Focus tests/build and Worker tests/typecheck, obtain an independent final review, then open gallery and all five local variants.

## Scientific basis and limits

Mifflin–St Jeor estimates resting expenditure from age, sex, height and weight; it is distinct from total daily burn ([original paper](https://pubmed.ncbi.nlm.nih.gov/2305711/)). Activity uses net MET energy above rest from the [2024 Adult Compendium](https://pacompendium.com/adult-compendium/), with weekly sessions averaged per day. Running already contributes exercise energy; steps can include or exclude those runs, explicitly, to prevent adding both estimates for the same movement.

Logged intake minus observed weight slope times 7,700 estimates energy expenditure, not basal metabolism. Short windows are dominated by water fluctuations and logging gaps; display available data with its window and an early label, without changing the target to fit. [Hall and Chow](https://pmc.ncbi.nlm.nih.gov/articles/PMC3127505/) explain why longer observation improves precision. [NIDDK's planner](https://www.niddk.nih.gov/bwp) models adaptation over time; our short conditional trend outlook is deliberately bounded and makes no precise long-term metabolic promise.

## Result and verification

Comparison entry: http://localhost:3000/weight/compare (requires FOCUS_LOCAL_PREVIEW=1). Each version uses an isolated owner on the existing local preview API. Original local Weight records were compared with a private pre-change manifest and remained unchanged. No remote database calls or deployment were performed. A private SQLite backup was made before additive local schema/variant initialization.

Focus: 128 tests pass; production TypeScript/Vite/PWA build passes. Worker: 52 tests and typecheck pass, including transactional workout persistence, variant copy isolation/restart/rollback, and persistent-database refusal for the synthetic self-check. Browser regressions pass for all five concepts, phase replacement confirmation, expired phase date preservation, checkpoint chart/history agreement and persistence, independent calorie targets, running-step choice, workout limits, inline weight add/edit error retention, human dates, calorie bars and keyboard opening, food-only drawer/backdrop, and unphysical early-estimate handling. Existing concurrent food/retry/stale-refresh regression also passes. Real-data screenshots were inspected in light and dark themes at desktop and phone sizes. External AI estimation was mocked in automated checks.

Independent review issues were corrected: inherited calorie budgets leaking into phase-free concepts; missing historical weight creation; chart bounds omitting the average; phase replacement and edited start/deadline preservation; checkpoint targets diverging across consumers; workout limits; and a potentially destructive persistent self-check. The reality outlook now displays the same pace used by its projection and summary stats. No Important findings remained in the final review.

Checkpoints use browser storage for this prototype, scoped by concept. Calorie targets, goals, activity and food use the local API. The five concepts share the same underlying arithmetic; differences are workflow choices. Short-window expenditure is labeled early, nonpositive implied burn is labeled unstable, and neither is forced to match the profile estimate or destination. Existing board bundle-size and pnpm settings warnings remain outside this change.

Focused guardrail review covered scope/data preservation, explicit missing and failed states, latest-read ownership, one target-reference calculation, additive API persistence and retirement of unused suggested-plan/forecast helpers. Validation: the checks above and final diff whitespace checks.
