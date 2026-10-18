import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse, goalLine, loggedDayTotals, streakBefore, movingAverage, parseSheetRows } from '../src/weight/model.ts';

const sheet = 'DATE\tWEIGHT\tGOAL\n14/10/2026\t81\t81,00\n15/10/2026\t80,55\t80,94\n16/10/2026\t81,05\t80,89\n17/10/2026\t80,75\t80,83\n18/10/2026\t\t80,78';
const phases = [{ startDate: '2026-10-14', maintenanceKcal: 2300, intakeKcal: 1800 }];

test('sheet rows parse with comma decimals and skip empty weights', () => {
  assert.deepEqual(parseSheetRows(sheet), [
    { date: '2026-10-14', weightKg: 81 }, { date: '2026-10-15', weightKg: 80.55 },
    { date: '2026-10-16', weightKg: 81.05 }, { date: '2026-10-17', weightKg: 80.75 },
  ]);
});

test('goal drops by the planned deficit at 7700 kcal/kg, bending at a new phase', () => {
  const entries = parseSheetRows(sheet);
  const goal = goalLine(entries, [...phases, { startDate: '2026-10-16', maintenanceKcal: 2300, intakeKcal: 2300 }], '2026-10-18');
  assert.deepEqual(goal.map(point => point.date), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.ok(Math.abs(goal[1].weightKg - (81 - 500 / 7700)) < 1e-9);
  assert.equal(goal[2].weightKg, goal[4].weightKg);
});

test('moving average uses a calendar window, not the last seven rows', () => {
  assert.deepEqual(movingAverage([{ date: '2026-10-01', weightKg: 90 }, { date: '2026-10-10', weightKg: 80 }, { date: '2026-10-11', weightKg: 82 }]), [90, 80, 81]);
});

test('analysis recovers real maintenance from a steady trend', () => {
  // Losing 0.1 kg/day while eating 1800 means burning 1800 + 770.
  const entries = Array.from({ length: 21 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, weightKg: 85 - i * 0.1 }));
  const result = analyse(entries, [{ ...phases[0], startDate: '2026-10-01' }])!;
  assert.ok(Math.abs(result.kgPerWeek! + 0.7) < 1e-9);
  assert.equal(result.maintenanceKcal, 2570);
  assert.ok(Math.abs(result.plannedKgPerWeek! + 3500 / 7700) < 1e-9);
  assert.equal(analyse(parseSheetRows(sheet), phases)!.maintenanceKcal, null);
});

test('streak counts consecutive days up to yesterday', () => {
  const entries = parseSheetRows(sheet);
  assert.equal(streakBefore(entries, '2026-10-18'), 4);
  assert.equal(streakBefore(entries, '2026-10-19'), 0);
});

test('complete-looking past food days replace the planned intake', () => {
  const entries = Array.from({ length: 21 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, weightKg: 85 - i * 0.1 }));
  const plan = [{ startDate: '2026-10-01', maintenanceKcal: 2300, intakeKcal: 1800 }];
  // Eating 2100 on every closed day (all 20 intervals) lifts the estimate by 300.
  const meals = entries.slice(0, 20).flatMap(({ date }) => [{ id: `${date}a`, date, description: '', kcal: 1000, createdAt: '' }, { id: `${date}b`, date, description: '', kcal: 1100, createdAt: '' }]);
  const result = analyse(entries, plan, 21, loggedDayTotals(meals, plan, '2026-10-21'))!;
  assert.equal(result.maintenanceKcal, 2870);
  assert.equal(result.loggedDays, 20);
  assert.equal(loggedDayTotals(meals, plan, '2026-10-01').size, 0, 'today and later are still in progress');
  const partial = [{ id: 'x', date: '2026-10-01', description: '', kcal: 600, createdAt: '' }];
  assert.equal(loggedDayTotals(partial, plan, '2026-10-21').size, 0, 'a day under half the plan is probably missing meals');
});
