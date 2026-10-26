# Final Weight: goal phases with optional intake and observed outlook

The user selected Goal phases and asked for an optional daily intake target per phase, visible in Telegram, plus the Reality forecast panel. Keep target weight/date lines fixed and independent of observed seven-day averages, food intake and weight-based burn. Remove alternative prototype workflows from the final screen.

A goal adds intakeKcal?: number|null. Blank explicitly removes that phase's budget; an omitted field on older API clients preserves it. Store optional intake separately in weight_goal_intakes keyed by user/start_date to avoid ALTER and deploy safely with the idempotent schema. Goal and intake writes commit together. App and Telegram select the latest effective goal by the food's assigned date, even when that goal has no intake target; this must not revive an older budget. Before any goal exists, historical calorie phases remain readable for compatibility.

The phase editor saves start, destination weight/date and optional daily intake together. Starting on an occupied date still confirms replacement; editing keeps the phase start and saved deadline. Phase history shows its budget or no calorie target. The current phase budget appears in Food and the daily drawer. Reality forecast and its chart projection are always present when enough actual readings exist; neither is driven by calorie targets.

Retire unselected concept branches, checkpoint state, comparison gallery and standalone calorie editor. Preserve all private local prototype records, original local records, existing legacy calorie data and asynchronous food queue behavior. Final local preview uses the selected goal-phases owner's existing real-data copy. No production database writes, Telegram sends, deployment or dependency changes.

Verification: API optional-intake validation/set/clear/omit behavior and atomic rollback; Telegram date-sensitive target selection and explicit no-budget handling; frontend same target selection including zero; phase editor and history persistence; fixed target/forecast after budget edits; failed draft retention; existing food queue checks; desktop/phone preview; Focus/Worker tests, typechecks/build, and fresh review.

## Verified result

The final app lives at /weight; the old local comparison URLs resolve to the same final view. The local preview continues with the previously selected goal-phases copy, preserving original and alternate prototype records. The phase editor and history show optional daily intake, Food/drawers use the phase effective on each assigned date, and the short observed outlook is always included in the plan and chart. Historical phase start/deadline protection, replacement confirmation and asynchronous meal recovery remain intact.

126 Focus tests and 59 Worker tests pass. Focus production build and Worker typecheck pass. Final browser coverage exercises intake set/clear/zero, reload persistence, failed-save drafts, historical intake selection, unchanged goal/forecast after calorie edits, phase replacement, expired deadlines, calorie graph/drawer, profile sports and phone layout. Existing concurrent-food regression and real-data read-only desktop/phone preview pass. Private screenshot review found and corrected a narrow editor layout; actual local original records were checked unchanged.

The new guarded phase/intake write was additionally exercised against the installed local Cloudflare D1 runtime using `node tests/weight-d1-check.mjs`, covering successful/invalid updates, null, omitted and zero targets, and rollback after a storage error. It uses the existing Wrangler dependencies and an isolated temporary database. D1's documented batch transaction behavior is described in the [official database API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

Fresh review found no Important issues. Production deployment and real Telegram/AI calls were not performed; Telegram summary behavior is covered by local worker tests. Short-window burn/outlook values remain estimates with visible early-data context.


## Compact layout feedback

Removed the duplicate current-phase edit button, repeated seven-day trend/burn summary, and forecast explanatory sentence. Phase editing remains in the history disclosure. The food/calorie log sits left of a compact plan/forecast card on desktop and stacks above it below 1,000px. Removed displaced CSS and checked read-only real-data layouts, full phase editing/persistence, concurrent food behavior and the production build.


The next visual pass placed phase creation alongside the history disclosure, moved the outlook beside the goal on wide screens, and consolidated average intake, burn and energy difference into the labelled energy graph. Only protein and resting estimates remain in metric boxes; resting metabolism has an accessible icon edit control. Existing phase save/clear/history browser coverage, real-data desktop/phone layouts and the production build pass. No API, calculation or stored-data changes were needed.


## Goal arrival instead of an unrelated projected weight

The saved goal is now labelled as a seven-day-average target with its chosen deadline. The adjacent outlook estimates when that same weight would be reached at the recent observed pace and compares that date with the saved deadline. Goal/deadline/intake changes remain independent: intake or deadline edits do not change arrival; changing the target weight does. Both the chart forecast and arrival calculation use one shared average/pace fit and an explicit observation cutoff. Future records remain editable in history without affecting current statistics. Sparse, stale, non-decreasing, already-at-goal and more-than-a-year cases have explicit messages rather than fabricated dates. The plotted outlook remains bounded to 21 days; arrival solves for the target independently with a one-year uncertainty horizon.

Verified 130 Focus tests, production build, expanded browser tests including a future-dated weight, unchanged arrival after a calorie-only edit, and read-only desktop/phone real-data previews. Fresh review's future-record cutoff finding was corrected and independently rechecked. The arrival estimate was checked against the saved target and deadline without changing saved values or production records.


## Simplified arrival and activity estimate

The outlook now shows only “Reach goal by” and the estimated date, with the deadline comparison; the duplicate target weight and pace are removed. Entered steps are defined as walking steps, so running stays in the weekly workouts and no inclusion question or cadence deduction remains. Archived inclusion flags remain readable for older clients but do not alter the current calculation; new profile saves set the legacy flag false. The editable metric shows the full profile daily-burn estimate, matching the editor, rather than resting metabolism alone.

The weight, deadline and optional intake are saved phase inputs; remaining days is the calendar difference, and actual progress uses the seven-day mean. No automatic intake recommendation is implied. Verified 130 Focus tests, production build, phase/profile browser coverage (including hidden question removal and matching summary/editor totals) and read-only real-data desktop/phone previews.


## BMI summary

Replaced the To goal tile with BMI and removed the duplicate observed-burn tile, leaving four summary cards. BMI uses the latest recorded weight on or before today and saved height, rounded to one decimal; the inputs/date appear below it. It follows the [CDC metric formula](https://www.cdc.gov/bmi/about/), weight in kg divided by height in metres squared. No diagnostic categories are added. Missing or invalid height leaves an explicit unavailable value. Verified the numeric conversion/guards, future-weight exclusion, updates after saving height, missing-profile handling, desktop/phone layouts and production build.

## Workout estimates and units

Compare workout calories per session separately from their weekly daily contribution. Keep the net active-energy addition above rest and average sessions/week over seven days, so exercise does not add resting energy twice. Provide both active and total session estimates and activity-specific easy/normal/hard presets from the [2024 Compendium](https://pacompendium.com/). Default normal values preserve current estimates: strength 3.5, running 7.5, cycling 6.8 and freestyle swimming 5.8 MET. Heart rate alone is not used to force calorie output to a watch reading. New optional workout.effort (easy|normal|hard) persists in the existing validated workout JSON; missing values use normal. No schema/remote-data change is required.

Clarify the fixed background assumption as a 20%-of-resting daily allowance for digestion and untracked activity. Retain that approximation openly rather than presenting it as a measured component. Shorten the observed-evidence sentence to its food-day and weigh-in counts plus early-estimate status. Center the workout remove icon in a fixed square aligned with its inputs.

Presets use the Compendium's [running](https://pacompendium.com/running/), [conditioning](https://pacompendium.com/conditioning-exercise/), [cycling](https://pacompendium.com/bicycling/) and [swimming](https://pacompendium.com/water-activities/) entries. Verified 133 Focus tests, 60 Worker tests, Worker typecheck and the Focus production build. Browser checks cover effort persistence, draft retention after save failure, blank duration, centered controls and phone layout. Read-only previews confirm session calories and weekly daily averages use consistent units; no record mutations or provider calls occurred.

## Compact drawer and running pace

Age, height, equation sex and walking steps share a desktop row; phones use two columns. Each desktop workout puts its controls on one row, followed by a single calorie-summary line. Measured workout height fell from 239 to 115 px, and the measurements section from 144 to 61 px.

Jogging accepts km/h; Running accepts min/km as minutes:seconds (whole minutes also work). Both store optional `speedKmh` in the existing workout JSON, preserving the exact numeric speed when changing display units or reopening a rounded pace. A supplied speed selects the nearest published level-ground speed range from the [2024 Compendium](https://pacompendium.com/running/); 4:00, 5:00, 6:00 and 7:00 min/km produce distinct expenditure estimates. Older workouts without a speed retain their saved effort assumption until a speed is entered. Invalid speeds cannot overwrite stored measurements or workouts. No schema change or automatic data rewrite is needed.

Verified 135 Focus tests, 61 Worker tests, Worker typecheck, the Focus production build, and browser checks for pace conversion, save/reopen, invalid-input preservation and exact-speed retention. Read-only previews confirm desktop summary lines fit and the drawer has no horizontal overflow at 390 or 320 px. Local records were not changed by preview verification.
