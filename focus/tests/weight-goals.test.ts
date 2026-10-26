import assert from 'node:assert/strict';
import test from 'node:test';
import { dayNumber, dateOf, type FoodDay, type WeightEntry, type WeightGoal, type WeightProfile } from '../src/weight/model.ts';
import { goalOn, goalProgress, goalReference, observedExpenditure, observedTrendForecast, profileExpenditure, workoutExpenditure } from '../src/weight/goals.ts';

const profile: WeightProfile = { age: 40, heightCm: 180, sex: 'male', activityFactor: 1.6 };
const entriesFrom = (date: string, count: number, first = 80, dailyChange = 0): WeightEntry[] => Array.from({ length: count }, (_, i) => ({ date: dateOf(dayNumber(date) + i), weightKg: first + i * dailyChange }));
const loggedDays = (date: string, count: number, kcal = 2100): FoodDay[] => Array.from({ length: count }, (_, i) => ({ date: dateOf(dayNumber(date) + i), kcal, mealCount: 2 }));
const goal: WeightGoal = { startDate: '2090-01-07', startWeightKg: 80, targetDate: '2090-01-17', targetWeightKg: 79 };

test('legacy profile expenditure preserves the saved multiplier until new activity is supplied', () => {
  const expected = { restingKcal: 1730, totalKcal: 2768, backgroundKcal: 1038, stepsKcal: 0, sportKcal: 0, legacyActivity: true };
  assert.deepEqual(profileExpenditure(profile, 80), expected);
  assert.deepEqual(profileExpenditure({ ...profile, stepsPerDay: null, sport: null, sportMinutes: null, sportDaysPerWeek: null }, 80), expected);
  assert.deepEqual(profileExpenditure({ ...profile, workouts: null, stepsIncludeRuns: null }, 80), expected);
  const female = profileExpenditure({ ...profile, sex: 'female', activityFactor: 1.4 }, 80);
  assert.equal(female.restingKcal, 1564);
  assert.equal(female.totalKcal, 2189.6);
});

test('explicit zero steps switches from the legacy multiplier to the sedentary background', () => {
  assert.deepEqual(profileExpenditure({ ...profile, stepsPerDay: 0 }, 80), { restingKcal: 1730, totalKcal: 2076, backgroundKcal: 346, stepsKcal: 0, sportKcal: 0, legacyActivity: false });
});

test('walking adds net expenditure from daily steps rather than another activity multiplier', () => {
  const result = profileExpenditure({ ...profile, stepsPerDay: 10000, sport: 'none', sportMinutes: 100, sportDaysPerWeek: 7 }, 80);
  assert.deepEqual(result, { restingKcal: 1730, totalKcal: 2356, backgroundKcal: 346, stepsKcal: 280, sportKcal: 0, legacyActivity: false });
});

test('sport calories use net METs and spread sessions over all seven days', () => {
  const cases = [
    { sport: 'strength' as const, kcal: 35 },
    { sport: 'cycling' as const, kcal: 81.2 },
    { sport: 'running' as const, kcal: 91 },
    { sport: 'swimming' as const, kcal: 67.2 },
  ];
  for (const { sport, kcal } of cases) {
    const result = profileExpenditure({ ...profile, stepsPerDay: 0, sport, sportMinutes: 70, sportDaysPerWeek: 1 }, 80);
    assert.ok(Math.abs(result.sportKcal - kcal) < 1e-9, sport);
    assert.ok(Math.abs(result.totalKcal - (2076 + kcal)) < 1e-9, sport);
  }
});

test('a session exposes active and total calories separately from its daily contribution', () => {
  const run = { sport: 'running' as const, minutesPerSession: 30, sessionsPerWeek: 1 };
  const once = workoutExpenditure(run, 80);
  assert.ok(Math.abs(once.sessionActiveKcal - 273) < 1e-9);
  assert.ok(Math.abs(once.sessionTotalKcal - 315) < 1e-9);
  assert.ok(Math.abs(once.dailyActiveKcal - 39) < 1e-9);
  const twice = workoutExpenditure({ ...run, sessionsPerWeek: 2 }, 80);
  assert.equal(twice.sessionActiveKcal, once.sessionActiveKcal);
  assert.equal(twice.sessionTotalKcal, once.sessionTotalKcal);
  assert.equal(twice.dailyActiveKcal, 2 * once.dailyActiveKcal);
  const baseline = profileExpenditure({ ...profile, stepsPerDay: 0, workouts: [] }, 80);
  const withRun = profileExpenditure({ ...profile, stepsPerDay: 0, workouts: [run] }, 80);
  assert.ok(Math.abs(withRun.totalKcal - baseline.totalKcal - once.dailyActiveKcal) < 1e-9, 'resting energy is already counted');
});

test('activity-specific effort presets use published METs and preserve omitted defaults', () => {
  const cases = [
    { sport: 'strength' as const, mets: [3, 3.5, 6] },
    { sport: 'running' as const, mets: [6.5, 7.5, 9.3] },
    { sport: 'cycling' as const, mets: [4, 6.8, 10] },
    { sport: 'swimming' as const, mets: [4.8, 5.8, 9.8] },
  ];
  for (const { sport, mets } of cases) {
    const workout = { sport, minutesPerSession: 30, sessionsPerWeek: 1 };
    assert.deepEqual(workoutExpenditure(workout, 80), workoutExpenditure({ ...workout, effort: 'normal' }, 80));
    assert.deepEqual(workoutExpenditure({ ...workout, effort: null }, 80), workoutExpenditure(workout, 80));
    for (const [index, effort] of (['easy', 'normal', 'hard'] as const).entries()) {
      const result = workoutExpenditure({ ...workout, effort }, 80);
      assert.ok(Math.abs(result.sessionTotalKcal - mets[index] * 42) < 1e-9, `${sport}/${effort}`);
      assert.ok(Math.abs(result.sessionTotalKcal - result.sessionActiveKcal - 42) < 1e-9);
      assert.ok(Math.abs(profileExpenditure({ ...profile, stepsPerDay: 0, workouts: [{ ...workout, effort }] }, 80).sportKcal - result.dailyActiveKcal) < 1e-9);
    }
  }
});

test('running and jogging use the same published speed bands with different display units', () => {
  for (const { pace, met } of [{ pace: 4, met: 14.8 }, { pace: 5, met: 11.8 }, { pace: 6, met: 9.3 }, { pace: 7, met: 8.5 }]) {
    const running = { sport: 'running' as const, speedKmh: 60 / pace, minutesPerSession: 30, sessionsPerWeek: 2, effort: 'easy' as const };
    const result = workoutExpenditure(running, 80);
    assert.ok(Math.abs(result.sessionTotalKcal - met * 42) < 1e-9, `${pace}:00 min/km`);
    assert.deepEqual(workoutExpenditure({ ...running, sport: 'jogging' }, 80), result, 'units do not alter expenditure');
    assert.ok(Math.abs(profileExpenditure({ ...profile, stepsPerDay: 1000, workouts: [running] }, 80).sportKcal - result.dailyActiveKcal) < 1e-9);
  }
  assert.deepEqual(workoutExpenditure({ sport: 'jogging', minutesPerSession: 30, sessionsPerWeek: 1 }, 80), workoutExpenditure({ sport: 'running', minutesPerSession: 30, sessionsPerWeek: 1 }, 80));
  assert.ok(Math.abs(workoutExpenditure({ sport: 'jogging', speedKmh: 6, minutesPerSession: 30, sessionsPerWeek: 1 }, 80).sessionTotalKcal - 3.3 * 42) < 1e-9, 'gaps use the nearest published speed range');
});

test('running and cycling leave entered walking steps unchanged', () => {
  const activity = { ...profile, stepsPerDay: 10000, sportMinutes: 70, sportDaysPerWeek: 1 };
  const running = profileExpenditure({ ...activity, sport: 'running' }, 80);
  assert.ok(Math.abs(running.stepsKcal - 280) < 1e-9);
  assert.ok(Math.abs(running.totalKcal - 2447) < 1e-9);
  const cycling = profileExpenditure({ ...activity, sport: 'cycling' }, 80);
  assert.equal(cycling.stepsKcal, 280);
  assert.ok(Math.abs(cycling.totalKcal - 2437.2) < 1e-9);
});

test('running workouts do not consume a small walking-step total', () => {
  const result = profileExpenditure({ ...profile, stepsPerDay: 1000, sport: 'running', sportMinutes: 70, sportDaysPerWeek: 1 }, 80);
  assert.equal(result.stepsKcal, 28);
  assert.equal(result.sportKcal, 91);
  assert.equal(result.totalKcal, 2195);
});

test('multiple weekly workouts add their own net calories without repeating legacy sport', () => {
  const result = profileExpenditure({ ...profile, stepsPerDay: 10000, sport: 'running', sportMinutes: 70, sportDaysPerWeek: 7, workouts: [
    { sport: 'strength', minutesPerSession: 70, sessionsPerWeek: 1 },
    { sport: 'cycling', minutesPerSession: 35, sessionsPerWeek: 2 },
  ] }, 80);
  assert.ok(Math.abs(result.sportKcal - 116.2) < 1e-9);
  assert.equal(result.stepsKcal, 280);
  assert.ok(Math.abs(result.totalKcal - 2472.2) < 1e-9);
});

test('archived running-step choices cannot change the walking-only assumption', () => {
  const activity = { ...profile, stepsPerDay: 10000, workouts: [{ sport: 'running' as const, minutesPerSession: 70, sessionsPerWeek: 1 }] };
  const included = profileExpenditure({ ...activity, stepsIncludeRuns: true }, 80);
  const excluded = profileExpenditure({ ...activity, stepsIncludeRuns: false }, 80);
  assert.equal(included.stepsKcal, 280);
  assert.deepEqual(included, excluded);
  assert.equal(excluded.stepsKcal, 280);
  assert.equal(included.sportKcal, 91);
  assert.equal(excluded.sportKcal, 91);
});

test('an explicit empty workout list retires the saved one-sport activity', () => {
  const result = profileExpenditure({ ...profile, sport: 'cycling', sportMinutes: 70, sportDaysPerWeek: 7, workouts: [] }, 80);
  assert.equal(result.legacyActivity, false);
  assert.equal(result.sportKcal, 0);
  assert.equal(result.totalKcal, 2076);
});

test('goal versions preserve saved baselines and end each reference at its deadline', () => {
  const first = { startDate: '2026-10-01', startWeightKg: 82, targetDate: '2026-10-05', targetWeightKg: 80 };
  const next = { startDate: '2026-10-04', startWeightKg: 81.2, targetDate: '2026-10-08', targetWeightKg: 79.2 };
  const goals = [next, first];
  assert.equal(goalOn(goals, '2026-09-30'), undefined);
  assert.equal(goalOn(goals, '2026-10-03'), first);
  assert.equal(goalOn(goals, '2026-10-04'), next);
  assert.equal(goalOn(goals, '2026-10-20'), next);
  const reference = goalReference(goals, '2026-10-20');
  assert.equal(reference[0].weightKg, 82);
  assert.equal(reference[2].weightKg, 81);
  assert.equal(reference[3].weightKg, 81.2);
  assert.deepEqual(reference.at(-1), { date: '2026-10-08', weightKg: 79.2 });
  assert.equal(reference.length, 8);
  assert.deepEqual(goals, [next, first], 'reference generation must not mutate saved versions');
});

test('conditional trend forecast anchors to the calendar average and stops after 21 days', () => {
  const actual = entriesFrom('2026-10-01', 15, 85, -0.1);
  const outlook = observedTrendForecast(actual, '2026-12-01', '2026-10-15');
  assert.equal(outlook.length, 22);
  assert.equal(outlook[0].date, '2026-10-15');
  assert.ok(Math.abs(outlook[0].weightKg - 83.9) < 1e-9);
  assert.equal(outlook.at(-1)!.date, '2026-11-05');
  assert.ok(Math.abs(outlook.at(-1)!.weightKg - 81.8) < 1e-9);
  assert.equal(observedTrendForecast(actual, '2026-10-17', '2026-10-15').length, 3);
  assert.deepEqual(observedTrendForecast(actual, '2026-10-14', '2026-10-15'), []);
});

test('conditional trend forecast stays unavailable with sparse or too-short weight history', () => {
  assert.deepEqual(observedTrendForecast([], '2026-10-20', '2026-10-20'), []);
  assert.deepEqual(observedTrendForecast(entriesFrom('2026-10-01', 7), '2026-10-20', '2026-10-20'), []);
  assert.deepEqual(observedTrendForecast([{ date: '2026-10-01', weightKg: 80 }, { date: '2026-10-15', weightKg: 79 }], '2026-10-20', '2026-10-20'), []);
});

test('goal completion requires four distinct recent readings and one on the evaluation day', () => {
  const target = { ...goal, startDate: '2026-10-01', targetDate: '2026-10-31', targetWeightKg: 80 };
  const readings = [{ date: '2026-10-01', weightKg: 90 }, { date: '2026-10-10', weightKg: 79 }, { date: '2026-10-12', weightKg: 80 }, { date: '2026-10-14', weightKg: 79 }];
  assert.deepEqual(goalProgress(readings, target, '2026-10-14'), { trendKg: 238 / 3, readings: 3, reached: false });
  assert.equal(goalProgress([...readings, readings[3]], target, '2026-10-14')!.reached, false, 'a repeated row is not a fourth day');
  const qualified = [...readings, { date: '2026-10-15', weightKg: 80 }];
  assert.deepEqual(goalProgress(qualified, target, '2026-10-15'), { trendKg: 79.5, readings: 4, reached: true });
  assert.equal(goalProgress(qualified, target, '2026-10-16')!.reached, false);
  assert.equal(goalProgress(qualified, target, '2026-09-30'), null);
  assert.equal(goalProgress(qualified, target, '2026-11-10'), null);
});

test('one low weigh-in cannot hide a seven-day average above the goal', () => {
  const readings = entriesFrom('2026-10-01', 7, 82);
  readings[6].weightKg = 79;
  assert.equal(goalProgress(readings, { ...goal, startDate: '2026-10-01', targetWeightKg: 80 }, '2026-10-07')!.reached, false);
});

test('observed expenditure uses the first available aligned day with its two boundary weights', () => {
  const readings = entriesFrom('2026-10-01', 2, 85, -0.1);
  const result = observedExpenditure(readings, loggedDays('2026-10-01', 1), '2026-10-02')!;
  const { kgPerWeek, ...summary } = result;
  assert.deepEqual(summary, { kcal: 2870, averageIntakeKcal: 2100, startDate: '2026-10-01', endDate: '2026-10-02', foodDays: 1, weighIns: 2, provisional: true });
  assert.ok(Math.abs(kgPerWeek + 0.7) < 1e-9);
  assert.equal(observedExpenditure(readings.slice(0, 1), loggedDays('2026-10-01', 1), '2026-10-02'), null);
});

test('observed burn rounds to whole kcal without snapping to 50-kcal steps', () => {
  const result = observedExpenditure(entriesFrom('2026-10-01', 8, 80, -0.019), loggedDays('2026-10-01', 7), '2026-10-08')!;
  assert.equal(result.kcal, 2246);
});

test('calibration grows toward 28 days and remains provisional below 21 days', () => {
  const cases = [
    { count: 14, start: '2026-10-01', end: '2026-10-15', days: 14, provisional: true },
    { count: 20, start: '2026-10-01', end: '2026-10-21', days: 20, provisional: true },
    { count: 21, start: '2026-10-01', end: '2026-10-22', days: 21, provisional: false },
    { count: 28, start: '2026-10-01', end: '2026-10-29', days: 28, provisional: false },
    { count: 35, start: '2026-10-08', end: '2026-11-05', days: 28, provisional: false },
  ];
  for (const expected of cases) {
    const result = observedExpenditure(entriesFrom('2026-10-01', expected.count + 1, 85, -0.1), loggedDays('2026-10-01', expected.count), expected.end);
    const { kgPerWeek, ...summary } = result!;
    assert.deepEqual(summary, { kcal: 2870, averageIntakeKcal: 2100, startDate: expected.start, endDate: expected.end, foodDays: expected.days, weighIns: expected.days + 1, provisional: expected.provisional });
    assert.ok(Math.abs(kgPerWeek + 0.7) < 1e-9);
  }
});

test('calibration prefers the newest eligible endpoint over a longer older interval', () => {
  const readings = entriesFrom('2026-10-01', 30, 85, -0.1).filter(entry => entry.date !== '2026-10-02');
  const result = observedExpenditure(readings, loggedDays('2026-10-01', 29), '2026-10-30')!;
  assert.equal(result.endDate, '2026-10-30');
  assert.equal(result.startDate, '2026-10-03');
  assert.equal(result.foodDays, 27);
});

test('observed expenditure excludes food on its last weight boundary and all later observations', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  const days = [...loggedDays('2026-10-01', 7), ...loggedDays('2026-10-08', 3, 10000)];
  assert.equal(observedExpenditure([...readings, { date: '2026-10-09', weightKg: 60 }], days, '2026-10-08')!.kcal, 2870);
});

test('logged zero stays zero while missing food and empty days remain unknown', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  const days = loggedDays('2026-10-01', 7, 0);
  assert.equal(observedExpenditure(readings, days, '2026-10-08')!.kcal, 770);
  assert.equal(observedExpenditure(readings, days.map(day => ({ ...day, kcal: null })), '2026-10-08'), null);
  assert.equal(observedExpenditure(readings, days.map(day => ({ ...day, mealCount: 0 })), '2026-10-08'), null);
});

test('missing food breaks the interval rather than falling back to a calorie plan', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  const days = loggedDays('2026-10-01', 7);
  for (const replacement of [undefined, { ...days[3], kcal: null }, { ...days[3], mealCount: 0 }]) {
    const changed = days.filter((_, i) => i !== 3);
    if (replacement) changed.push(replacement);
    const result = observedExpenditure(readings, changed, '2026-10-08')!;
    assert.equal(result.startDate, '2026-10-05');
    assert.equal(result.foodDays, 3);
  }
  assert.equal(observedExpenditure(readings, loggedDays('2026-10-01', 7, 600), '2026-10-08')!.kcal, 1370);
});

test('a food gap restarts the longest contiguous interval after that day', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const days = loggedDays('2026-10-01', 28).filter(day => day.date !== '2026-10-11');
  const result = observedExpenditure(readings, days, '2026-10-29')!;
  assert.equal(result.startDate, '2026-10-12');
  assert.equal(result.foodDays, 17);
  assert.equal(result.provisional, true);
});

test('editing a logged food total immediately changes the aligned estimate', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  const days = loggedDays('2026-10-01', 7);
  assert.equal(observedExpenditure(readings, days, '2026-10-08')!.kcal, 2870);
  days[3].kcal = 2800;
  assert.equal(observedExpenditure(readings, days, '2026-10-08')!.kcal, 2970);
});

test('historical aligned calibration stays available without using food after the last weigh-in', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const days = [...loggedDays('2026-10-01', 28), ...loggedDays('2026-10-29', 14, 10000)];
  const result = observedExpenditure(readings, days, '2026-11-05')!;
  assert.ok(result);
  assert.equal(result.endDate, '2026-10-29');
  assert.equal(result.startDate, '2026-10-01');
  assert.equal(result.averageIntakeKcal, 2100);
  assert.equal(result.kcal, 2870);
});

test('calibration requires two distinct boundary weights without inventing missing readings', () => {
  const all = entriesFrom('2026-10-01', 8, 85, -0.1);
  const sparse = [all[0], all[2], all[5], all[7]];
  const days = loggedDays('2026-10-01', 7);
  assert.equal(observedExpenditure(sparse, days, '2026-10-08')!.weighIns, 4);
  assert.equal(observedExpenditure([all[0], all[7], all[0]], days, '2026-10-08')!.weighIns, 2);
  assert.equal(observedExpenditure(sparse.slice(1), days, '2026-10-08')!.startDate, '2026-10-03');
  assert.equal(observedExpenditure([all[7], all[7]], days, '2026-10-08'), null);
});

test('sparse long intervals remain provisional until enough weight readings are available', () => {
  const full = entriesFrom('2026-10-01', 29, 85, -0.1);
  const sparse = observedExpenditure([full[0], full[28]], loggedDays('2026-10-01', 28), '2026-10-29')!;
  assert.equal(sparse.foodDays, 28);
  assert.equal(sparse.weighIns, 2);
  assert.equal(sparse.provisional, true);
  const fourteen = full.filter((_, i) => i % 2 === 0).filter((_, i) => i !== 1);
  const result = observedExpenditure(fourteen, loggedDays('2026-10-01', 28), '2026-10-29')!;
  assert.equal(result.weighIns, 14);
  assert.equal(result.foodDays, 28);
  assert.equal(result.provisional, false);
});

test('observed intake averages every known food day over the same weight interval', () => {
  const readings = [{ date: '2026-10-01', weightKg: 80 }, { date: '2026-10-03', weightKg: 79.8 }];
  const days = [{ date: '2026-10-01', kcal: 1000, mealCount: 1 }, { date: '2026-10-02', kcal: 3000, mealCount: 3 }];
  const result = observedExpenditure(readings, days, '2026-10-03')!;
  assert.equal(result.averageIntakeKcal, 2000);
  assert.equal(result.kcal, 2770);
  assert.ok(Math.abs(result.kgPerWeek + 0.7) < 1e-9);
});

test('gaining weight puts observed expenditure below the aligned intake', () => {
  assert.equal(observedExpenditure(entriesFrom('2026-10-01', 8, 80, 0.1), loggedDays('2026-10-01', 7), '2026-10-08')!.kcal, 1330);
});

test('phase intake follows the latest effective goal and a blank target suppresses older budgets', async () => {
  const { intakeTargetOn } = await import('../src/weight/goals.ts');
  const old = [{ startDate: '2026-01-01', maintenanceKcal: 2300, intakeKcal: 1800 }];
  const goals = [
    { ...goal, startDate: '2026-10-01', intakeKcal: 1900 },
    { ...goal, startDate: '2026-10-10', intakeKcal: null },
    { ...goal, startDate: '2026-10-20', intakeKcal: 0 },
  ];
  assert.equal(intakeTargetOn(goals, old, '2026-09-30'), 1800);
  assert.equal(intakeTargetOn(goals, old, '2026-10-01'), 1900);
  assert.equal(intakeTargetOn(goals, old, '2026-10-19'), null);
  assert.equal(intakeTargetOn(goals, old, '2026-10-20'), 0);
  assert.equal(intakeTargetOn([...goals].reverse(), old, '2026-10-05'), 1900);
  assert.equal(intakeTargetOn([], [], '2026-10-01'), null);
});

test('goal arrival estimates when the same target average is reached, independently of the chosen deadline and intake', async () => {
  const { goalArrival } = await import('../src/weight/goals.ts');
  const actual = entriesFrom('2026-10-01', 15, 85, -0.1);
  const target = { ...goal, targetWeightKg: 83, targetDate: '2026-11-20', intakeKcal: 1800 };
  const arrival = goalArrival(actual, target, '2026-10-15');
  assert.equal(arrival.status, 'estimated');
  assert.ok(arrival.status === 'estimated');
  assert.equal(arrival.date, '2026-10-24');
  assert.ok(Math.abs(arrival.kgPerWeek + 0.7) < 1e-9);
  assert.deepEqual(goalArrival(actual, { ...target, targetDate: '2027-01-01', intakeKcal: 2500 }, '2026-10-15'), arrival);
  const longer = goalArrival(actual, { ...target, targetWeightKg: 80 }, '2026-10-15');
  assert.ok(longer.status === 'estimated');
  assert.equal(longer.date, '2026-11-23', 'the target arrival is not an arbitrary 21-day weight projection');
});

test('goal arrival handles insufficient, stale, reached and non-decreasing weight trends without a false date', async () => {
  const { goalArrival } = await import('../src/weight/goals.ts');
  const target = { ...goal, targetWeightKg: 78 };
  assert.equal(goalArrival(entriesFrom('2026-10-01', 7), target, '2026-10-07').status, 'insufficient-data');
  assert.equal(goalArrival(entriesFrom('2026-10-01', 15, 80), target, '2026-10-15').status, 'not-progressing');
  assert.equal(goalArrival(entriesFrom('2026-10-01', 15, 80, 0.1), target, '2026-10-15').status, 'not-progressing');
  assert.equal(goalArrival(entriesFrom('2026-10-01', 15, 80, -0.1), { ...target, targetWeightKg: 79 }, '2026-10-15').status, 'at-goal');
  assert.equal(goalArrival(entriesFrom('2026-10-01', 15, 80, -0.1), target, '2026-10-22').status, 'needs-weigh-in');
  assert.equal(goalArrival(entriesFrom('2026-10-01', 15, 85, -0.1), { ...target, targetWeightKg: 83.8 }, '2026-10-17').status, 'needs-weigh-in', 'do not promise a future arrival in the past without a new weigh-in');
  assert.equal(goalArrival(entriesFrom('2026-10-01', 15, 85, -0.01), { ...target, targetWeightKg: 20 }, '2026-10-15').status, 'long-range');
});

test('goal arrival and the plotted forecast share the same average and pace and ignore future readings', async () => {
  const { goalArrival } = await import('../src/weight/goals.ts');
  const actual = entriesFrom('2026-10-01', 15, 85, -0.1);
  const target = { ...goal, targetWeightKg: 83 };
  const projected = observedTrendForecast(actual, '2026-10-24', '2026-10-15').at(-1)!;
  assert.ok(Math.abs(projected.weightKg - target.targetWeightKg) < 1e-9);
  const arrival = goalArrival(actual, target, '2026-10-15');
  assert.ok(arrival.status === 'estimated');
  assert.equal(arrival.date, projected.date);
  const withFuture = [...actual, { date: '2026-10-30', weightKg: 70 }];
  assert.deepEqual(goalArrival(withFuture, target, '2026-10-15'), arrival);
  assert.deepEqual(observedTrendForecast(withFuture, '2026-11-05', '2026-10-15'), observedTrendForecast(actual, '2026-11-05', '2026-10-15'));
});

test('arrival uncertainty horizon is measured from today rather than the last recorded weight', async () => {
  const { goalArrival } = await import('../src/weight/goals.ts');
  const actual = entriesFrom('2026-10-01', 15, 85, -0.01);
  const arrival = goalArrival(actual, { ...goal, targetWeightKg: 81.23 }, '2026-10-17');
  assert.ok(arrival.status === 'estimated');
  assert.equal(arrival.date, '2027-10-16');
});
