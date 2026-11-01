# Calorie and weight pattern

## Revision: one timeline

The user found the scatter plot difficult to understand and chose to keep the comparison on the original Progress timeline, highlighting high-calorie days. Remove the separate panel, its styles, aggregation helper and obsolete tests. Keep the existing 3,000 kcal highlight threshold.

Show food bars by default. Mark days at or above 3,000 kcal with orange bars and a light vertical band, with a labelled legend. Keep current weight/average/target/forecast lines, ranges, food editing and the ability to hide calories. A food day's tooltip shows the exact following morning's weight and change from that day's morning; missing readings stay unknown, never use the next available reading. Future or absent readings cannot create a result.

Plan: first adapt the synthetic browser regression to the timeline and observe failure; then update WeightChart and remove the displaced scatter implementation; update existing preview/browser toggles for the new default; run Focus tests/build, timeline and food browser checks, inspect desktop/phone/light/dark previews, and review the final change. No new dependencies, API/schema changes or writes to personal records.

Verified revision: 137 Focus tests and production build pass. Synthetic timeline coverage checks the inclusive threshold, positive/negative/zero changes, missing next-morning and future readings, toggle behavior, keyboard and touch food editing, and 320/390px layouts. Existing food browser regression passes. Inspected dark/light phone and desktop previews. Fresh review's accessible-description finding was fixed with a unique tooltip ID, tooltip role and aria-describedby relationship, verified by a regression that failed before the fix. Static chart lines no longer block food-bar taps. The retired scatter and its unused aggregation/tests/styles are removed.

## Initial version

The user wants the overall relationship between logged calories and subsequent weight changes, especially days around 3,000 kcal. A new panel below Progress compares all recorded history, using the existing private Weight API response.

Approaches considered: inspecting individual days (the user preferred the overall pattern), adding more overlapping lines to Progress (harder to read), or a scatter plot plus grouped averages (chosen implementation). Each dot shows one food day's kcal against the change between that morning's weight and an exact later weigh-in. Default: next morning; alternatives: 3 and 7 calendar days later. The two groups are below 3,000 kcal and at least 3,000 kcal. Show mean scale change and sample count separately for each group; no numerical result when a group is empty.

Only completed food days with logged food and both exact boundary weigh-ins count. Respect the existing 02:00 food-day rollover. Exclude future readings, keep missing food unknown, and never interpolate missing weights. All-time history is used, independently of Progress's range. Food estimates may be incomplete; later food/activity and short-term water changes confound this association. Do not infer fat gain or causation, predict weight, change targets, or write records.

Keep React, CSS and native SVG/HTML; no dependencies, API/schema changes, analytics or deployment. Use cyan/orange with labels so colour is not the only distinction. Native point buttons support focus/touch and reveal values below the chart. Empty and one-group states remain usable.

## Implementation plan

- [x] Add `calorieWeightPattern(entries, days, lagDays: 1 | 3 | 7, today, foodDay)` and `CALORIE_PATTERN_THRESHOLD` in `focus/src/weight/model.ts`. Return dated points, high/low `{ count, meanChangeKg }` and skipped-day count. First add focused tests in `focus/tests/weight.test.ts` for alignment, lag, missing/zero/invalid values, incomplete/future days and empty groups; watch them fail, then pass.
- [x] Add `focus/src/weight/CalorieWeightPattern.tsx`, mount below Progress in `WeightApp.tsx`, and append scoped CSS in `weight.css`. Show two group summaries, zero/threshold references, exact change-window control, sample coverage and point values. Add `focus/tests/weight-pattern-browser.mjs` against a fully synthetic API; first verify the missing panel fails, then verify lag changes, keyboard/touch interaction, empty states, privacy, 320/390px and desktop layouts.
- [x] Run Focus tests and production build, existing food browser regression, final region/diff review, and fresh review. Leave local work ready for review without pushing or deploying.

Review focus: food-to-weight calendar alignment; 02:00 rollover; missing versus zero values; sparse or one-sided samples; overlapping points and small screens. Baseline: 136 Focus tests pass. Work stays on the existing `codex/weight-goals` branch; unrelated untracked files remain untouched.

## Verification

140 Focus tests pass; the production build succeeds (existing chunk-size and Browserslist warnings remain). New browser coverage passes for grouped means, all three windows, keyboard access, actual touch taps, missing groups/food, 320/390px layouts and read-only inspection. Existing concurrent-food/editing browser regression also passes. Dark and actual light-theme screenshots were inspected; a failing contrast check led to darker teal in light mode and opaque markers (at least 3:1 measured contrast for both series).

Fresh review found no production correctness/privacy issue. Its overnight browser-fixture finding was resolved by moving synthetic food dates earlier, so yesterday is never assumed complete before 02:00. Identical samples intentionally share a position; summary counts include each sample, keyboard focus reaches each, and the caption explains overlap. No live data, provider calls, schema changes, pushes or deployment were needed.
