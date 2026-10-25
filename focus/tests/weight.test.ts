import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse, streakBefore, movingAverage, parseSheetRows } from '../src/weight/model.ts';

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
