# Weight feedback implementation

The user's eleven feedback items supersede the manual food-review workflow and separate goal and calorie cards in the earlier design. Implement directly in the current local preview, preserving the user's profile, goals, meals and phase history.

## User facing changes

- Remove the redundant View and edit this day button, Open a day form, manual meal-entry form, and all food-review/confirmation controls and badges.
- History rows still open a day; today's existing food form remains editable. Separate calories and their units cleanly.
- Use a fixed protein target of 1.5 g/kg in Focus and Telegram, including existing plan displays; keep historical stored values for compatibility without using them as the current target.
- Clicking the native drawer backdrop closes it through the same draft-discard protection as Escape. Submitted AI jobs continue independently and remain visible on reopening.
- Clear the food composer on submission, display each submitted estimate, and keep the composer enabled for another item. Failed jobs preserve their description/photo and can be retried or dismissed independently.
- Automatically count finished food days with logged meals. Never treat missing food as zero or replace it with planned intake. No reviews or explicit day closing.
- Show the first observed expenditure estimate after a seven-day aligned interval with at least four weigh-ins. Expand toward 28 days as data accumulates; use at least max(4, ceil(days / 2)) weigh-ins and both boundary weights. Prefer the latest available endpoint within the last seven food days, then the longest contiguous eligible interval. Label fewer than 21 days provisional. Current/future food remains excluded.
- Combine goal, resting metabolism, daily expenditure, intake, energy bar, deficit, pace, protein and phase history into one Weight plan card. Saving goal/profile immediately updates its proposed numbers. Applying the displayed proposal creates/replaces a phase explicitly; the chart continues to use accepted phases. Keep the existing energy graphic and manual phase editing in collapsed plan history.

## Shared model and API

`FoodDay = { date: string; kcal: number | null; mealCount: number }`. GET day details becomes `{ date, meals }`. Remove the day-reviews endpoint and runtime review storage/invalidation. Existing local review tables can remain unused; do not drop production data.

Extend `WeightProfile` with optional nullable `stepsPerDay`, `sport`, `sportMinutes`, and `sportDaysPerWeek`; retain `activityFactor` for reading legacy profiles. `sport` is none, strength, cycling, running, or swimming. New profile forms use average daily steps, sport, minutes per session and sessions per week; no multiplier input. Store new activity in a new idempotent `weight_activity` table to avoid ALTER statements.

Profile calculation returns `{ restingKcal, totalKcal, backgroundKcal, stepsKcal, sportKcal, legacyActivity }`. Legacy profiles retain their saved estimate until the user supplies activity. New estimates use Mifflin resting expenditure, a sedentary background allowance (20% of resting), net walking expenditure estimated at 100 steps/min and 3 MET, and net sport expenditure using (MET - 1) × 3.5 × kg / 200 × daily-average minutes. Sport METs: strength 3.5, cycling 6.8, running/jogging 7.5, swimming 5.8. Running steps are estimated at 160/min and subtracted from daily walking steps to avoid counting them twice; clamp only the remaining walking steps at zero. These activity assumptions are approximate and must remain distinct from the food-based estimate. Bounds: steps 0–100000 integer, minutes/session 0–600, sessions/week 0–14; no sport normalizes duration/frequency to zero.

Sources: [Adult Compendium](https://pacompendium.com/adult-compendium/), [walking cadence study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6337834/). Activity is a starting approximation; a seven-day food/weight estimate is early evidence, not an exact basal measurement.

`observedExpenditure` retains kcal/startDate/endDate/foodDays/weighIns and adds `provisional: boolean`. `suggestPhase` always sets the current protein target to 1.5 g/kg. Keep existing fixed target, deadline averaging, finite-value validation and scheduled-phase handling.

## Work and verification

- Model task owns `model.ts`, `goals.ts`, and calculation tests. Write/run failing tests for seven-day automatic food, growing windows, gaps, edits, steps/sport and protein, then implement and run Focus tests/types.
- API task owns Worker handlers/schema/routes/tests. Remove confirmation machinery, store/validate activity, apply protein formula, preserve user isolation, AI quota and nutrient correction. Keep manual POST request compatibility while removing its UI. Write/run behavioural tests and Worker suite/typecheck. Do not change preview/import files.
- UI task owns the Weight components/CSS and browser regression. Keep pending jobs under the Weight page owner. Preserve failed writes and distinguish successful writes from failed refreshes.
- Run browser regression for queued estimates with delayed responses, a failed job, drawer backdrop/draft handling, removed controls, profile/goal-driven graphic updates, explicit phase acceptance, historical editing and layout at desktop/phone widths. Use only the synthetic test API for writes.
- Run final Focus/Worker suites, build/types, fresh review, and inspect the existing real-data preview without overwriting the user's changes. Keep services running locally and commit only task files; no push or deployment.

## Verification

Implemented the eleven feedback items. Focus127tests and Worker45tests pass; the production build and TypeScript checks pass. Both browser regressions pass: combined plan updates/explicit acceptance, historical edits, removed controls, mobile layout, concurrent text/photo jobs, independent retries, drawer persistence/backdrop protection, saved-write refresh-only recovery and reversed day-response ordering.

Fresh review's drawer-response race was reproduced before the shared sequence guard and passes afterward. A noisy, negative early expenditure case was also reproduced and now leaves the saved energy graphic valid without changing the underlying estimate. Desktop, phone and calorie spacing were inspected against the real local data; no user records were overwritten. No deployment or production writes.
