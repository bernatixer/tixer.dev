import assert from 'node:assert/strict';
import test from 'node:test';
import { compactWeightDate, formatRunningPace, formatWeightDate, parseWorkoutSpeed } from '../src/weight/format.ts';

test('running pace uses minutes and seconds per kilometre and converts to speed', () => {
  assert.equal(parseWorkoutSpeed('running', '5'), 12);
  assert.equal(parseWorkoutSpeed('running', '5:00'), 12);
  assert.equal(parseWorkoutSpeed('running', '6:00'), 10);
  assert.ok(Math.abs(parseWorkoutSpeed('running', '5:30')! - 120 / 11) < 1e-9);
  assert.equal(formatRunningPace(12), '5:00');
  assert.equal(formatRunningPace(10), '6:00');
  assert.equal(formatRunningPace(120 / 11), '5:30');
  for (const input of ['', '0', '0:00', '5:60', '5:9', '5.5', '-6', '6:00:00', 'fast', '2:00', '16:00']) assert.equal(parseWorkoutSpeed('running', input), null, input);
  assert.equal(parseWorkoutSpeed('jogging', '8.5'), 8.5);
  assert.equal(parseWorkoutSpeed('jogging', '10'), parseWorkoutSpeed('running', '6:00'));
  for (const input of ['', '0', '-8', '3.9', '23.1', '5:30', 'fast', 'Infinity']) assert.equal(parseWorkoutSpeed('jogging', input), null, input);
});

test('weight dates show the named month, calendar day and year', () => {
  assert.equal(formatWeightDate('2026-10-26'), 'October 26, 2026');
  assert.equal(formatWeightDate('2024-02-29'), 'February 29, 2024');
  assert.equal(compactWeightDate('2026-10-26'), 'Oct 26');
});

test('weight dates retain the saved calendar day in another time zone', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(formatWeightDate('2027-01-01'), 'January 1, 2027');
    assert.equal(compactWeightDate('2027-01-01'), 'Jan 1');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
