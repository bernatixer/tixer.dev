import assert from 'node:assert/strict';
import test from 'node:test';
import { dayNumber, dateOf, movingAverage, type FoodDay, type Phase, type WeightEntry, type WeightGoal, type WeightProfile } from '../src/weight/model.ts';
import { forecast, goalOn, goalProgress, goalReference, observedExpenditure, profileExpenditure, suggestPhase } from '../src/weight/goals.ts';

const profile: WeightProfile = { age: 40, heightCm: 180, sex: 'male', activityFactor: 1.6 };
const entriesFrom = (date: string, count: number, first = 80, dailyChange = 0): WeightEntry[] => Array.from({ length: count }, (_, i) => ({ date: dateOf(dayNumber(date) + i), weightKg: first + i * dailyChange }));
const loggedDays = (date: string, count: number, kcal = 2100): FoodDay[] => Array.from({ length: count }, (_, i) => ({ date: dateOf(dayNumber(date) + i), kcal, mealCount: 2 }));
const goal: WeightGoal = { startDate: '2090-01-07', startWeightKg: 80, targetDate: '2090-01-17', targetWeightKg: 79 };
const entries = entriesFrom('2090-01-01', 7);
const phases: Phase[] = [{ startDate: '2090-01-01', maintenanceKcal: 2500, intakeKcal: 2000, proteinPerKg: 2 }];

test('legacy profile expenditure preserves the saved multiplier until new activity is supplied', () => {
  const expected = { restingKcal: 1730, totalKcal: 2768, backgroundKcal: 1038, stepsKcal: 0, sportKcal: 0, legacyActivity: true };
  assert.deepEqual(profileExpenditure(profile, 80), expected);
  assert.deepEqual(profileExpenditure({ ...profile, stepsPerDay: null, sport: null, sportMinutes: null, sportDaysPerWeek: null }, 80), expected);
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

test('running steps are removed from walking while cycling leaves walking unchanged', () => {
  const activity = { ...profile, stepsPerDay: 10000, sportMinutes: 70, sportDaysPerWeek: 1 };
  const running = profileExpenditure({ ...activity, sport: 'running' }, 80);
  assert.ok(Math.abs(running.stepsKcal - 235.2) < 1e-9);
  assert.ok(Math.abs(running.totalKcal - 2402.2) < 1e-9);
  const cycling = profileExpenditure({ ...activity, sport: 'cycling' }, 80);
  assert.equal(cycling.stepsKcal, 280);
  assert.ok(Math.abs(cycling.totalKcal - 2437.2) < 1e-9);
});

test('running can exhaust the recorded steps without subtracting from sport expenditure', () => {
  const result = profileExpenditure({ ...profile, stepsPerDay: 1000, sport: 'running', sportMinutes: 70, sportDaysPerWeek: 1 }, 80);
  assert.equal(result.stepsKcal, 0);
  assert.equal(result.sportKcal, 91);
  assert.equal(result.totalKcal, 2167);
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

test('observed expenditure starts automatically after seven aligned logged food days', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  assert.deepEqual(observedExpenditure(readings, loggedDays('2026-10-01', 7), '2026-10-08'), { kcal: 2850, startDate: '2026-10-01', endDate: '2026-10-08', foodDays: 7, weighIns: 8, provisional: true });
  assert.equal(observedExpenditure(readings.slice(0, 7), loggedDays('2026-10-01', 6), '2026-10-07'), null);
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
    assert.deepEqual(result, { kcal: 2850, startDate: expected.start, endDate: expected.end, foodDays: expected.days, weighIns: expected.days + 1, provisional: expected.provisional });
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
  assert.equal(observedExpenditure([...readings, { date: '2026-10-09', weightKg: 60 }], days, '2026-10-08')!.kcal, 2850);
});

test('logged zero stays zero while missing food and empty days remain unknown', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  const days = loggedDays('2026-10-01', 7, 0);
  assert.equal(observedExpenditure(readings, days, '2026-10-08')!.kcal, 750);
  assert.equal(observedExpenditure(readings, days.map(day => ({ ...day, kcal: null })), '2026-10-08'), null);
  assert.equal(observedExpenditure(readings, days.map(day => ({ ...day, mealCount: 0 })), '2026-10-08'), null);
});

test('missing food breaks the interval rather than falling back to a calorie plan', () => {
  const readings = entriesFrom('2026-10-01', 8, 85, -0.1);
  const days = loggedDays('2026-10-01', 7);
  for (const replacement of [undefined, { ...days[3], kcal: null }, { ...days[3], mealCount: 0 }]) {
    const changed = days.filter((_, i) => i !== 3);
    if (replacement) changed.push(replacement);
    assert.equal(observedExpenditure(readings, changed, '2026-10-08'), null);
  }
  assert.equal(observedExpenditure(readings, loggedDays('2026-10-01', 7, 600), '2026-10-08')!.kcal, 1350);
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
  assert.equal(observedExpenditure(readings, days, '2026-10-08')!.kcal, 2850);
  days[3].kcal = 2800;
  assert.equal(observedExpenditure(readings, days, '2026-10-08')!.kcal, 2950);
});

test('calibration expires after the seventh finished food day without an eligible endpoint', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const days = loggedDays('2026-10-01', 28);
  assert.equal(observedExpenditure(readings, days, '2026-11-04')!.endDate, '2026-10-29');
  assert.equal(observedExpenditure(readings, days, '2026-11-05'), null);
});

test('seven-day calibration requires four distinct weigh-ins and both boundaries', () => {
  const all = entriesFrom('2026-10-01', 8, 85, -0.1);
  const sparse = [all[0], all[2], all[5], all[7]];
  const days = loggedDays('2026-10-01', 7);
  assert.equal(observedExpenditure(sparse, days, '2026-10-08')!.weighIns, 4);
  assert.equal(observedExpenditure([all[0], all[2], all[7], all[2]], days, '2026-10-08'), null);
  assert.equal(observedExpenditure(sparse.slice(1), days, '2026-10-08'), null);
  assert.equal(observedExpenditure(sparse.slice(0, -1), days, '2026-10-08'), null);
});

test('longer calibration needs weight readings on at least half its days', () => {
  const all = entriesFrom('2026-10-01', 15, 85, -0.1);
  const readings = [all[0], all[1], all[2], all[3], all[14]];
  assert.equal(observedExpenditure(readings, loggedDays('2026-10-01', 14), '2026-10-15'), null);
  const full = entriesFrom('2026-10-01', 29, 85, -0.1);
  const fourteen = full.filter((_, i) => i % 2 === 0).filter((_, i) => i !== 1);
  const result = observedExpenditure(fourteen, loggedDays('2026-10-01', 28), '2026-10-29')!;
  assert.equal(result.weighIns, 14);
  assert.equal(result.foodDays, 28);
});

test('gaining weight puts observed expenditure below the aligned intake', () => {
  assert.equal(observedExpenditure(entriesFrom('2026-10-01', 8, 80, 0.1), loggedDays('2026-10-01', 7), '2026-10-08')!.kcal, 1350);
});

test('forecast returns future raw weights and applies phase changes to the following day', () => {
  const accepted = [{ startDate: '2026-10-01', maintenanceKcal: 2500, intakeKcal: 1730 }, { startDate: '2026-10-09', maintenanceKcal: 2500, intakeKcal: 2500 }];
  const future = forecast([{ date: '2026-10-07', weightKg: 80 }], accepted, '2026-10-10');
  assert.deepEqual(future.map(point => point.date), ['2026-10-08', '2026-10-09', '2026-10-10']);
  assert.ok(Math.abs(future[0].weightKg - 79.9) < 1e-9);
  assert.ok(Math.abs(future[2].weightKg - 79.8) < 1e-9);
  assert.deepEqual(forecast([{ date: '2026-10-07', weightKg: 80 }], accepted, '2026-10-10', '2026-10-10'), [future[2]]);
  assert.deepEqual(forecast([], accepted, '2026-10-10'), []);
});

test('forecast anchors to the latest actual reading without changing actual weights', () => {
  const actual = [{ date: '2026-10-01', weightKg: 90 }, { date: '2026-10-07', weightKg: 80 }];
  assert.deepEqual(forecast(actual, [], '2026-10-08'), [{ date: '2026-10-08', weightKg: 80 }]);
  assert.deepEqual(actual, [{ date: '2026-10-01', weightKg: 90 }, { date: '2026-10-07', weightKg: 80 }]);
});

test('suggested intake reaches the deadline average rather than only its final raw weight', () => {
  const result = suggestPhase(entries, phases, goal, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.phase.intakeKcal, 1400);
  assert.equal(result.phase.maintenanceKcal, 2500);
  assert.equal(result.phase.proteinPerKg, 1.5);
  assert.ok(Math.abs(result.projectedAverageKg - 79) < 1e-9);
  const raw = forecast(entries, [result.phase], goal.targetDate);
  assert.ok(raw.at(-1)!.weightKg < 78.6, 'the raw deadline weight must be below the target average');
  assert.ok(Math.abs(movingAverage([...entries, ...raw]).at(-1)! - 79) < 1e-9);
});

test('a near deadline average includes actual readings and rounds intake down to whole kcal', () => {
  const result = suggestPhase(entries, phases, { ...goal, targetDate: '2090-01-10', targetWeightKg: 79.9 }, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.phase.intakeKcal, 1601);
  assert.ok(result.projectedAverageKg <= 79.9);
  assert.ok(result.projectedAverageKg > 79.899);
});

test('a future proposal accounts for the accepted phase before it begins', () => {
  const accepted = [{ ...phases[0], intakeKcal: 1730 }];
  const result = suggestPhase(entries, accepted, goal, profile, 2500, '2090-01-09');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Two days at -0.1 kg, then the remaining phase has five effective days in the deadline mean.
  assert.equal(result.phase.intakeKcal, 1268);
  assert.ok(Math.abs(result.projectedAverageKg - 79) < 1e-9);
});

test('a proposal ends at the next scheduled phase and preserves that accepted phase', () => {
  const scheduled = { startDate: '2090-01-10', maintenanceKcal: 2500, intakeKcal: 2000, proteinPerKg: 1.7 };
  const accepted = [...phases, scheduled];
  const result = suggestPhase(entries, accepted, { ...goal, targetWeightKg: 79.5 }, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Three days of the proposal plus four effective days at -500/7700 kg/day.
  assert.equal(result.phase.intakeKcal, 1883);
  assert.ok(result.projectedAverageKg <= 79.5);
  assert.ok(result.projectedAverageKg > 79.499);
  assert.deepEqual(accepted, [...phases, scheduled]);
});

test('new proposals use the fixed protein target when there is no existing phase', () => {
  const result = suggestPhase(entries, [], goal, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.phase.proteinPerKg, 1.5);
});

test('a replacement proposal uses the fixed protein target without rewriting stored history', () => {
  const current = { startDate: '2090-01-07', maintenanceKcal: 3000, intakeKcal: 2000, proteinPerKg: 2.2 };
  const result = suggestPhase(entries, [current], goal, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.phase.intakeKcal, 1400);
  assert.equal(result.phase.proteinPerKg, 1.5);
  assert.equal(current.maintenanceKcal, 3000);
  assert.equal(current.proteinPerKg, 2.2);
});

test('the exact minimum intake is permitted and a lower required intake is rejected', () => {
  // The deadline average sees seven effective deficit days: 1,500 × 7 / 7,700 kg.
  const minimumGoal = { ...goal, targetWeightKg: 80 - 15 / 11 };
  const result = suggestPhase(entries, phases, minimumGoal, { ...profile, age: 20 }, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.phase.intakeKcal, 1000);
  const tooLow = suggestPhase(entries, phases, { ...minimumGoal, targetWeightKg: minimumGoal.targetWeightKg - 0.001 }, profile, 2500, '2090-01-07');
  assert.equal(tooLow.ok, false);
});

test('unsafe or infeasible proposals return a reason without clamping the intake or deadline', () => {
  const cases: Parameters<typeof suggestPhase>[] = [
    [entries, phases, goal, { ...profile, age: 19 }, 2500, '2090-01-07'],
    [entries, phases, { ...goal, targetWeightKg: 55 }, profile, 2500, '2090-01-07'],
    [entries, phases, { ...goal, targetDate: '2090-01-08' }, profile, 2500, '2090-01-07'],
    [entries, phases, { ...goal, targetDate: '2020-01-01' }, profile, 2500, '2090-01-07'],
    [entries, phases, goal, profile, 2500, goal.targetDate],
    [entries, phases, goal, profile, 2500, '2090-01-18'],
    [[], phases, goal, profile, 2500, '2090-01-07'],
    [entries, phases, goal, profile, NaN, '2090-01-07'],
  ];
  for (const args of cases) {
    const result = suggestPhase(...args);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.length > 0);
  }
});

test('recalculation uses corrected actual weights without rewriting a saved goal baseline', () => {
  const corrected = entries.map(entry => ({ ...entry, weightKg: 79.9 }));
  const saved = { ...goal };
  const result = suggestPhase(corrected, phases, saved, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.phase.intakeKcal, 1510);
  assert.deepEqual(saved, goal);
  assert.deepEqual(goalReference([saved], saved.startDate), [{ date: saved.startDate, weightKg: 80 }]);
});
