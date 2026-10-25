import assert from 'node:assert/strict';
import test from 'node:test';
import { dayNumber, dateOf, movingAverage, type FoodDay, type Phase, type WeightEntry, type WeightGoal, type WeightProfile } from '../src/weight/model.ts';
import { forecast, goalOn, goalProgress, goalReference, observedExpenditure, profileExpenditure, suggestPhase } from '../src/weight/goals.ts';

const profile: WeightProfile = { age: 40, heightCm: 180, sex: 'male', activityFactor: 1.6 };
const entriesFrom = (date: string, count: number, first = 80, dailyChange = 0): WeightEntry[] => Array.from({ length: count }, (_, i) => ({ date: dateOf(dayNumber(date) + i), weightKg: first + i * dailyChange }));
const completeDays = (date: string, count: number, kcal = 2100): FoodDay[] => Array.from({ length: count }, (_, i) => ({ date: dateOf(dayNumber(date) + i), kcal, mealCount: kcal ? 2 : 0, revision: 1, confirmedRevision: 1 }));
const goal: WeightGoal = { startDate: '2090-01-07', startWeightKg: 80, targetDate: '2090-01-17', targetWeightKg: 79 };
const entries = entriesFrom('2090-01-01', 7);
const phases: Phase[] = [{ startDate: '2090-01-01', maintenanceKcal: 2500, intakeKcal: 2000, proteinPerKg: 2 }];

test('profile expenditure applies the equation sex parameter and explicit activity factor', () => {
  assert.deepEqual(profileExpenditure(profile, 80), { restingKcal: 1730, totalKcal: 2768 });
  assert.deepEqual(profileExpenditure({ ...profile, sex: 'female', activityFactor: 1.4 }, 80), { restingKcal: 1564, totalKcal: 2189.6 });
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

test('observed expenditure aligns 28 reviewed food days with both weight boundaries', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const result = observedExpenditure(readings, completeDays('2026-10-01', 28), '2026-10-29');
  assert.deepEqual(result, { kcal: 2850, startDate: '2026-10-01', endDate: '2026-10-29', foodDays: 28, weighIns: 29 });
});

test('observed expenditure uses food before the last boundary and ignores later food and weights', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const days = [...completeDays('2026-10-01', 28), ...completeDays('2026-10-29', 3, 10000)];
  assert.equal(observedExpenditure([...readings, { date: '2026-10-30', weightKg: 60 }], days, '2026-10-29')!.kcal, 2850);
});

test('reviewed zero intake remains zero while an absent total is unknown', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const days = completeDays('2026-10-01', 28, 0);
  assert.equal(observedExpenditure(readings, days, '2026-10-29')!.kcal, 750);
  assert.equal(observedExpenditure(readings, days.map(day => ({ ...day, kcal: null })), '2026-10-29'), null);
});

test('incomplete, stale or missing food never falls back to a calorie plan', () => {
  const readings = entriesFrom('2026-10-01', 29, 85, -0.1);
  const days = completeDays('2026-10-01', 28);
  for (const replacement of [undefined, { ...days[10], confirmedRevision: null }, { ...days[10], revision: 2 }]) {
    const changed = days.filter((_, i) => i !== 10);
    if (replacement) changed.push(replacement);
    assert.equal(observedExpenditure(readings, changed, '2026-10-29'), null);
  }
});

test('calibration selects the newest eligible interval ending in the seven finished food days', () => {
  const readings = entriesFrom('2026-10-01', 35, 85, -0.1);
  const days = completeDays('2026-10-01', 34);
  const newest = observedExpenditure(readings, days, '2026-11-04')!;
  assert.equal(newest.startDate, '2026-10-07');
  assert.equal(newest.endDate, '2026-11-04');
  assert.equal(observedExpenditure(readings.slice(0, 29), days.slice(0, 28), '2026-11-04')!.endDate, '2026-10-29');
  assert.equal(observedExpenditure(readings.slice(0, 29), days.slice(0, 28), '2026-11-05'), null);
});

test('calibration requires 14 distinct weigh-ins and both boundaries', () => {
  const all = entriesFrom('2026-10-01', 29, 85, -0.1);
  const sparse = all.filter((_, i) => i % 2 === 0);
  const days = completeDays('2026-10-01', 28);
  assert.equal(observedExpenditure(sparse, days, '2026-10-29')!.weighIns, 15);
  const fourteen = sparse.filter((_, i) => i !== 1);
  assert.equal(observedExpenditure(fourteen, days, '2026-10-29')!.weighIns, 14);
  assert.equal(observedExpenditure([...fourteen.slice(0, 12), fourteen.at(-1)!, fourteen[0]], days, '2026-10-29'), null, 'duplicate dates cannot meet the minimum');
  assert.equal(observedExpenditure([...sparse.slice(0, 11), sparse[14]], days, '2026-10-29'), null);
  assert.equal(observedExpenditure(sparse.slice(1), days, '2026-10-29'), null);
  assert.equal(observedExpenditure(sparse.slice(0, -1), days, '2026-10-29'), null);
});

test('gaining weight puts observed expenditure below the aligned intake', () => {
  assert.equal(observedExpenditure(entriesFrom('2026-10-01', 29, 80, 0.1), completeDays('2026-10-01', 28), '2026-10-29')!.kcal, 1350);
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
  assert.equal(result.phase.proteinPerKg, 2);
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

test('missing protein settings use the existing phase default', () => {
  const result = suggestPhase(entries, [], goal, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.phase.proteinPerKg, 1.8);
});

test('a proposal can replace the phase on its start date while retaining that protein setting', () => {
  const current = { startDate: '2090-01-07', maintenanceKcal: 3000, intakeKcal: 2000, proteinPerKg: 2.2 };
  const result = suggestPhase(entries, [current], goal, profile, 2500, '2090-01-07');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.phase.intakeKcal, 1400);
  assert.equal(result.phase.proteinPerKg, 2.2);
  assert.equal(current.maintenanceKcal, 3000);
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
