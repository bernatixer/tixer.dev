# Weight goals and expenditure calibration

The Weight app will plan around a target weight and date, estimate daily energy expenditure from a profile and food logs, and let the user correct any day from History. Success means the seven-day average reaching the target. Recalculation proposes a new calorie phase for the user to accept; it never changes the active phase automatically.

## Confirmed intent

- Choose a target weight and date instead of deriving the goal from a manually entered calorie deficit.
- Keep phases and their history.
- Use food intake and weight trends to improve the expenditure estimate without forcing agreement between a forecast and the scale.
- Add daily calories to History and open a day drawer for inspection and corrections.
- Calculate or recalculate a starting estimate from a short questionnaire when useful.

## Approaches

The proposed approach is an established resting-energy equation plus activity and calibration from observed food and weight data. It builds on the existing model and keeps every numerical result reproducible. This is the implementation recommendation, not a user-selected physiological model.

A full physiological simulator, such as the model behind the NIDDK Body Weight Planner, would represent long-term adaptation and body composition in more detail. It also introduces more assumptions and substantially more implementation. Defer that simulator and label the first version's projections as approximations. Do not present a fixed calorie-to-weight conversion as an exact long-term prediction. [NIDDK model](https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner)

An LLM will not generate the expenditure or calorie target. Keep the existing LLM meal estimator; defer an additional AI interview or coaching endpoint. Deterministic questions and explanations cover the initial calculation without another model call or exposing profile measurements to a model.

## Goal and forecast

Store a goal version with its effective date, target weight, deadline, and the seven-day average at creation. Its reference line connects that saved starting average to the target average on the deadline. This line expresses the desired pace and stays fixed when expenditure estimates or calorie phases change.

The actual trend remains the existing calendar-window mean: average available weigh-ins in the preceding seven calendar days, including that day. Show the number of readings. As a product choice, require at least four distinct readings in that window and a weigh-in on the evaluation day before reporting the goal reached. A single low reading cannot complete a goal. Reaching means the qualifying average is at or below the target. New goals cover weight loss, with a target below the saved starting average. Existing manual maintenance phases remain usable; maintenance and weight-gain goals are outside this change.

The forecast is separate. Starting from recent actual weights, simulate future daily weights using the selected burn estimate and accepted calorie phases, then apply the same seven-day averaging function to those projected weights and recent real weights. Solve suggested intake against the projected seven-day average on the deadline, not the projected single-day weight. A proposed phase must start before the deadline and applies until the next accepted phase, if any; include those future phases when solving. If no permitted intake can meet the target, show that result. This accounts for the averaging lag without moving the goal or altering measurements.

For the initial version, use the existing 7,700 kcal/kg conversion for approximate energy-balance calculations. Hold the selected burn estimate constant within a phase, expose that assumption, and improve future estimates through recalculation. Forecast disagreement stays visible. Expenditure can change with body weight and activity, and water and logging error also affect apparent disagreement.

Changing a goal creates a new effective version rather than rewriting earlier target comparisons. Backdated corrections to actual weights update the actual trend and observed estimate; they do not silently change the saved goal baseline. Past-due goals show the result and current outlook without calculating an intake from zero or negative remaining days. Stop the goal reference at its deadline; do not extend a loss line indefinitely.

## Starting expenditure estimate

The questionnaire asks for age, height in centimetres, the sex parameter used by the equation, and usual activity. Use the current weight trend, with the latest weigh-in as a clearly labelled fallback when there is insufficient history. With no weigh-in, ask for one before calculating. Waist measurements are unnecessary for this equation.

Use Mifflin–St Jeor: resting kcal/day = 10 × kg + 6.25 × cm − 5 × age + the equation's sex-specific constant, +5 for male or −161 for female. Label this as estimated resting expenditure. Multiply by an explicit activity factor to estimate total daily expenditure; the default activity choices use 1.4, 1.6, 1.8, 2.0 and 2.2 with plain descriptions and a visible selected factor. These are initial assumptions, not measurements. [Original resting-energy study](https://www.sciencedirect.com/science/article/pii/S0002916523166986), [NIDDK activity guidance](https://www.niddk.nih.gov/bwp)

Save the profile so recalculation can reuse it. Allow the existing manually entered maintenance value as a source too. Display profile estimate, observed estimate when available, and the burn value selected for a proposal as distinct quantities. Food and weight alone estimate total expenditure; they cannot isolate basal metabolism.

## Calibration and food coverage

Replace the current substitution of planned intake for missing or low food logs. Display actual logged totals even when incomplete; an absent log is unknown, not zero. A genuinely empty food day can be confirmed as complete with zero intake.

Add an optional food-log confirmation in the day drawer. It controls eligibility for calibration and does not close or lock the day. Older days start unreviewed. The recalculation review can confirm a selected date range after showing each day's total, so historical logs do not require opening every drawer. Adding, correcting or deleting a meal through either the web app or Telegram invalidates confirmation for that day until reviewed again.

For an observed estimate, use the most recent contiguous interval of 28 complete food days ending within the last seven finished food days. Require a weigh-in at both boundaries, at least 14 readings over the interval, and no current or future food day. Fit a least-squares slope to the raw weigh-ins over those boundaries. Average all food totals between the first boundary inclusive and last boundary exclusive. Both calculations must cover the same interval.

Observed total expenditure ≈ average intake − 7,700 × weight slope in kg/day. For example, 2,100 kcal/day with a slope of −0.4 kg/week gives about 2,540 kcal/day. Round displayed expenditure to the nearest 50 kcal; show the interval, food coverage and weigh-in count. This is an approximate estimate supported by reviewed logs, not a direct metabolic measurement or a statistical confidence interval. Extended, frequent weight measurements improve precision, but four weeks does not guarantee an accurate individual result. [Research on estimation and uncertainty](https://pmc.ncbi.nlm.nih.gov/articles/PMC3127505/)

If the required interval is unavailable, retain profile or manual planning and explain what observed data is missing. Never average only the logged food days while fitting weight across a longer interval, invent calories for gaps, or silently constrain the estimate to match the plan.

## Recalculation and accepted phases

Calculate and Recalculate show the goal, selected burn source, data interval, suggested daily intake, approximate pace, and the difference from the active phase. If an eligible observed estimate exists, preselect it; otherwise use the profile estimate, then the current manual value. The user can choose another available source before accepting.

Accepting writes a phase effective today or a chosen future date. Cancelling changes nothing. Existing phase editing stays available. Since phases are keyed by start date, accepting for a date that already has a phase must explicitly identify the replacement; never describe an overwrite as adding a new history record. Preserve earlier phases and their protein settings. A new phase carries forward the current protein setting or the existing default.

Validate finite values and real calendar dates at the API boundary. Automated proposals require age 20 or older, a target BMI of at least 18.5, a future deadline, and an intake of at least 1,000 kcal/day. These are proposal limits, not a claim that every accepted intake is appropriate for every person. If the calculation falls outside them, explain which input prevents a proposal and offer a later deadline or revised goal; do not silently clamp the intake or change the date. Preserve existing manual phase records and their API validation. [CDC adult BMI categories](https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html), [NIDDK planner limits](https://www.niddk.nih.gov/bwp)

## Daily history and drawer

History lists the union of weigh-in dates and food-log dates, including explicitly reviewed empty days. Its columns are date, weight, seven-day average, target, difference from target, and calories eaten. Missing weights and food logs appear as missing. Unreviewed totals remain visible with their review status.

Opening a date uses the Finance drawer's native dialog, styling and focus-return pattern. Show the day's weigh-in, food total, nutrients, calorie phase, and meals. Reuse the existing food entry and calorie correction behaviour with a selected date instead of hard-coded today. Support adding or correcting the weigh-in, adding a forgotten meal from text or photo, correcting meal calories, deleting a meal, and confirming food completeness. Also provide a date picker to open a completely empty historical day.

Include a manual meal entry with description and known calories so corrections do not require an AI estimate or consume its daily quota. Nutrients are optional and remain unknown when not supplied. Preserve the current proportional nutrient adjustment for calorie-only corrections. Failed writes retain the user's draft and show an error. Closing an unsaved manual entry asks before discarding it. Deletions use confirmation or the existing undo convention; keyboard operation and focus management remain available.

Use the existing assigned food dates and 02:00 rollover convention consistently across web and Telegram; do not rebucket old meals by their creation timestamp. A correction to an old date uses that date's phase for its calorie target. Changing a day refreshes its totals, the actual trend, calibration and forecast, while leaving accepted plans and saved goals intact.

## Storage and API changes

Keep `weight_entries`, `weight_phases` and `meals` and their existing callers. Add idempotent tables in `worker/schema.sql` for the saved profile, dated goal versions and food-day reviews. No alteration or backfill of production tables is needed. Do not infer review confirmations or a target weight/date from legacy phases.

Food-day reviews carry a revision and a confirmed revision. Every successful meal mutation advances that day's revision in the same D1 batch as the meal write. Confirmation supplies the revision the user reviewed and succeeds only if it still matches; a concurrent Telegram edit cannot leave an outdated confirmation looking current. Put this behaviour in the existing shared meal mutation paths and cover web corrections, Telegram corrections, additions, deletes and undo.

Extend `/api/weight` with profile, goals, review states and daily calorie summaries. Replace the 35-day meal-loading limit as the source for History: return summaries covering all recorded dates, plus recent meal details for the current view and calibration. Load one older day's meal details when its drawer opens. This avoids downloading all meal descriptions on every visit while retaining complete history.

Add authenticated profile, goal, day-detail and day-review routes under `/api/weight`. Extend the existing meal route with explicit manual creation, preserving the existing estimation request and quota semantics. All reads and writes remain scoped to the authenticated user. Use D1 batches for goal or phase acceptance that requires multiple writes, and retain existing data when any write fails. Keep weight/profile/day content out of client analytics and do not introduce new sensitive payloads into AI analytics.

## Scope and verification

Implementation reaches `focus/src/weight/`, the existing food and Finance drawer patterns, Worker weight and meal handlers, Telegram mutation callers, `worker/src/index.ts`, the idempotent schema, and the existing weight and Telegram tests and local preview fixtures. The landing app, its generated `docs/`, deliberate duplicate theme files, dependencies and deployment configuration need no changes. This design lives in `designs/` because `docs/` is generated and erased by the landing-page build.

Add focused model checks for goal averaging and sparse readings, forecast averaging lag, fixed historical targets, expenditure direction and interval alignment, missing food, true zero food, and expired goals. Add API checks for per-user isolation, manual entries without quota use, older-day retrieval, stale confirmations, atomic meal invalidation across both channels, same-date phase replacement and legacy data without a goal or profile. Update preview fixtures and exercise the drawer with keyboard navigation and a narrow screen. Run the Focus tests and build, and Worker tests and typecheck.

Remaining builder choices are component boundaries, route spelling, copy and responsive details using the existing design system. They must preserve the behaviour above. The full physiological simulator, extra AI coaching, exercise tracking and unrelated cleanup are outside this change. Publishing and production database actions remain subject to the repository's explicit approval requirements.
