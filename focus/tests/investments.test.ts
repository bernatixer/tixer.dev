import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInvestment } from '../src/finance/calculations.ts';
import { createDefaultFinanceData, migrateFinanceData, validateFinanceData } from '../src/finance/model.ts';
const row = { id: 'fund', label: 'Synthetic fund', balance: 150000, observedOn: '2026-10-12', equityPercent: null, bondPercent: null, totalContributions: 120000, totalWithdrawals: 10000, cashFlowsConfirmed: true };

test('gain counts withdrawals, never treats deposits as earnings, and is not annualised', () => {
  assert.deepEqual(calculateInvestment(row), { netAdded: 110000, gain: 40000, gainPercent: 40000 / 120000 * 100 });
  assert.equal(calculateInvestment({ ...row, balance: 180000, totalContributions: 150000 }).gain, 40000);
  assert.equal(calculateInvestment({ ...row, balance: 90000, totalWithdrawals: 0 }).gain, -30000);
  assert.equal(calculateInvestment({ ...row, totalContributions: 0 }).gainPercent, null);
  assert.equal(calculateInvestment({ ...row, balance: 0, totalWithdrawals: 180000 }).gain, 60000);
});

test('missing balance or contributions cannot produce a gain', () => {
  assert.deepEqual(calculateInvestment({ ...row, totalContributions: null }), { netAdded: null, gain: null, gainPercent: null });
  assert.deepEqual(calculateInvestment({ ...row, balance: null }), { netAdded: 110000, gain: null, gainPercent: null });
});

test('withdrawals default to zero and gains need no confirmation', () => {
  assert.deepEqual(calculateInvestment({ ...row, cashFlowsConfirmed: false, totalWithdrawals: null }), { netAdded: 120000, gain: 30000, gainPercent: 25 });
  assert.equal(calculateInvestment({ ...row, cashFlowsConfirmed: false }).gain, 40000);
});

test('v2 migration preserves old contributions and encrypted fields without inventing withdrawal history', () => {
  const current = createDefaultFinanceData('2026-10-12');
  const { totalWithdrawals: _withdrawals, cashFlowsConfirmed: _confirmed, ...oldRow } = row;
  const legacy = { ...current, version: 2, portfolios: [oldRow] };
  const before = structuredClone(legacy);
  const migrated = migrateFinanceData(legacy);
  assert.equal(migrated.version, 3); assert.equal(migrated.portfolios[0].totalContributions, 120000);
  assert.equal(migrated.portfolios[0].totalWithdrawals, null); assert.equal(migrated.portfolios[0].cashFlowsConfirmed, false);
  assert.deepEqual(migrateFinanceData(migrated), migrated); assert.deepEqual(legacy, before);
  assert.throws(() => migrateFinanceData({ ...legacy, portfolios: [{ ...oldRow, totalWithdrawals: 0 }] }));
});

test('cash goals need no retired scenario; flow confirmation requires known balance and totals', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.cash = [{ id: 'cash', label: 'Synthetic bank', balance: 200000, observedOn: '2026-10-12', earmarks: [{ id: 'goal', label: 'Replacement laptop', amount: 30000, purpose: 'other', plannedCostId: null }] }];
  validateFinanceData(data);
  data.portfolios = [{ ...row, totalWithdrawals: null }];
  assert.throws(() => validateFinanceData(data), /both money totals/);
  data.portfolios[0].cashFlowsConfirmed = false; validateFinanceData(data);
  data.cash[0].earmarks[0].amount = 300000;
  assert.throws(() => validateFinanceData(data), /exceeds observed cash/);
});
