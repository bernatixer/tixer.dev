import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse, carbTarget, streakBefore, movingAverage, parseSheetRows, trendAt } from '../src/weight/model.ts';
import * as weightModel from '../src/weight/model.ts';

const sheet = 'DATE\tWEIGHT\tGOAL\n14/10/2026\t81\t81,00\n15/10/2026\t80,55\t80,94\n16/10/2026\t81,05\t80,89\n17/10/2026\t80,75\t80,83\n18/10/2026\t\t80,78';

test('sheet rows parse with comma decimals and skip empty weights', () => {
  assert.deepEqual(parseSheetRows(sheet), [
    { date: '2026-10-14', weightKg: 81 }, { date: '2026-10-15', weightKg: 80.55 },
    { date: '2026-10-16', weightKg: 81.05 }, { date: '2026-10-17', weightKg: 80.75 },
  ]);
});

test('moving average uses a calendar window, not the last seven rows', () => {
  assert.deepEqual(movingAverage([{ date: '2026-10-01', weightKg: 90 }, { date: '2026-10-10', weightKg: 80 }, { date: '2026-10-11', weightKg: 82 }]), [90, 80, 81]);
});

test('trend at a date uses only the preceding seven calendar days and returns null when stale', () => {
  const entries = [{ date: '2026-10-12', weightKg: 82 }, { date: '2026-10-01', weightKg: 90 }, { date: '2026-10-10', weightKg: 80 }, { date: '2026-10-20', weightKg: 70 }];
  assert.equal(trendAt(entries, '2026-10-13'), 81);
  assert.equal(trendAt(entries, '2026-10-16'), 81);
  assert.equal(trendAt(entries, '2026-10-17'), 82);
  assert.equal(trendAt(entries, '2026-10-19'), null);
  assert.equal(trendAt([], '2026-10-13'), null);
});

test('analysis reports the recent trend, change and weekly weight pace', () => {
  const entries = Array.from({ length: 21 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, weightKg: 85 - i * 0.1 }));
  const result = analyse(entries)!;
  assert.ok(Math.abs(result.trendKg - 83.3) < 1e-9);
  assert.ok(Math.abs(result.changeKg + 1.7) < 1e-9);
  assert.ok(Math.abs(result.kgPerWeek! + 0.7) < 1e-9);
});

test('analysis leaves pace unknown without a full week of weight history', () => {
  assert.equal(analyse([]), null);
  assert.deepEqual(analyse([{ date: '2026-10-01', weightKg: 82 }, { date: '2026-10-06', weightKg: 80 }]), { trendKg: 81, changeKg: -1, kgPerWeek: null });
});

test('analysis uses calendar days and the requested pace window', () => {
  const entries = [{ date: '2026-10-01', weightKg: 85 }, { date: '2026-10-08', weightKg: 84.3 }, { date: '2026-10-15', weightKg: 83.6 }, { date: '2026-10-22', weightKg: 82.9 }];
  assert.ok(Math.abs(analyse(entries)!.kgPerWeek! + 0.7) < 1e-9);
  assert.equal(analyse(entries, 7)!.kgPerWeek, null);
});

test('streak counts consecutive days up to yesterday', () => {
  const entries = parseSheetRows(sheet);
  assert.equal(streakBefore(entries, '2026-10-18'), 4);
  assert.equal(streakBefore(entries, '2026-10-19'), 0);
});

test('BMI uses weight in kilograms and converts saved height from centimetres', async () => {
  const { bodyMassIndex } = await import('../src/weight/model.ts');
  assert.ok(Math.abs(bodyMassIndex(79.25, 175)! - 25.877551020408163) < 1e-9);
  assert.equal(bodyMassIndex(80, 200), 20);
  for (const [weight, height] of [[80, 0], [0, 175], [80, -175], [NaN, 175], [80, Infinity]]) assert.equal(bodyMassIndex(weight, height), null);
});

test('carb target reserves calories for the fixed protein target and minimum fat', () => {
  assert.equal(carbTarget(2000, 80), 272);
  assert.equal(carbTarget(1800, 70), 251);
  for (const [kcal, kg] of [[null, 80], [2000, undefined], [0, 80], [500, 80], [2000, 0], [2000, -80]]) assert.equal(carbTarget(kcal, kg), null);
});

test('calorie pattern pairs food with subsequent scale changes, independently of input order', () => {
  const result = weightModel.calorieWeightPattern([
    { date: '2026-10-03', weightKg: 80.25 }, { date: '2026-10-01', weightKg: 80 },
    { date: '2026-10-02', weightKg: 80.5 },
  ], [
    { date: '2026-10-02', kcal: 2000, mealCount: 3 }, { date: '2026-10-01', kcal: 3000, mealCount: 4 },
  ], 1, '2026-10-04', '2026-10-04');
  assert.deepEqual(result.points, [
    { date: '2026-10-01', endDate: '2026-10-02', kcal: 3000, changeKg: 0.5 },
    { date: '2026-10-02', endDate: '2026-10-03', kcal: 2000, changeKg: -0.25 },
  ]);
  assert.deepEqual(result.high, { count: 1, meanChangeKg: 0.5 });
  assert.deepEqual(result.low, { count: 1, meanChangeKg: -0.25 });
  assert.equal(result.skippedDays, 0);
});

test('calorie pattern uses exact calendar endpoints for three and seven days, without interpolation', () => {
  const entries = [
    { date: '2026-10-30', weightKg: 80 }, { date: '2026-11-02', weightKg: 80.25 },
    { date: '2026-11-06', weightKg: 79.5 },
  ];
  const days = [{ date: '2026-10-30', kcal: 3300, mealCount: 3 }];
  assert.equal(weightModel.calorieWeightPattern(entries, days, 3, '2026-11-07', '2026-11-07').high.meanChangeKg, 0.25);
  assert.equal(weightModel.calorieWeightPattern(entries, days, 7, '2026-11-07', '2026-11-07').high.meanChangeKg, -0.5);
  const missing = weightModel.calorieWeightPattern(entries, days, 1, '2026-11-07', '2026-11-07');
  assert.deepEqual(missing.points, []);
  assert.equal(missing.skippedDays, 1);
  assert.deepEqual(missing.high, { count: 0, meanChangeKg: null });
});

test('calorie pattern excludes open food days and future weights, including before the 02:00 rollover', () => {
  const entries = [
    { date: '2026-10-30', weightKg: 80 }, { date: '2026-10-31', weightKg: 81 },
    { date: '2026-11-01', weightKg: 82 }, { date: '2026-11-02', weightKg: 83 },
  ];
  const days = entries.map(entry => ({ date: entry.date, kcal: 3200, mealCount: 4 }));
  const overnight = weightModel.calorieWeightPattern(entries, days, 1, '2026-11-01', '2026-10-31');
  assert.deepEqual(overnight.points.map(point => point.date), ['2026-10-30']);
  const morning = weightModel.calorieWeightPattern(entries, days, 1, '2026-11-01', '2026-11-01');
  assert.deepEqual(morning.points.map(point => point.date), ['2026-10-30', '2026-10-31']);
  const future = weightModel.calorieWeightPattern(entries, days, 3, '2026-11-01', '2026-11-01');
  assert.deepEqual(future.points, []);
});

test('calorie pattern preserves real zero intake and zero changes, rejects unknown or invalid samples, and averages groups', () => {
  const entries = Array.from({ length: 9 }, (_, index) => ({ date: `2026-10-0${index + 1}`, weightKg: [80, 80, 81, 80.5, 81, 81, 81, NaN, 81][index] }));
  const days = [
    { date: '2026-10-01', kcal: 0, mealCount: 1 }, { date: '2026-10-02', kcal: 3000, mealCount: 3 },
    { date: '2026-10-03', kcal: 4000, mealCount: 4 }, { date: '2026-10-04', kcal: null, mealCount: 0 },
    { date: '2026-10-05', kcal: 2000, mealCount: 0 }, { date: '2026-10-06', kcal: Infinity, mealCount: 1 },
    { date: '2026-10-07', kcal: 3200, mealCount: 4 }, { date: '2026-10-08', kcal: -100, mealCount: 1 },
  ];
  const result = weightModel.calorieWeightPattern(entries, days, 1, '2026-10-10', '2026-10-10');
  assert.equal(result.points.length, 3);
  assert.deepEqual(result.low, { count: 1, meanChangeKg: 0 });
  assert.deepEqual(result.high, { count: 2, meanChangeKg: 0.25 });
  assert.equal(result.skippedDays, 1);
  const empty = weightModel.calorieWeightPattern([], [], 1, '2026-10-10', '2026-10-10');
  assert.deepEqual(empty.low, { count: 0, meanChangeKg: null });
  assert.deepEqual(empty.high, { count: 0, meanChangeKg: null });
});
