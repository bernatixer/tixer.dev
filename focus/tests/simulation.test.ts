import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultFinanceData, MAX_MONEY } from '../src/finance/model.ts';
import { simulate, createScenario, projectionRange, type Scenario } from '../src/finance/simulation.ts';

function fixture() {
  const data = createDefaultFinanceData('2026-10-13');
  data.income.regularAmount = 10000;
  data.cash = [{ id: 'bank', label: 'Bank', balance: 500000, observedOn: '2026-10-13', earmarks: [] }];
  data.portfolios = [{ id: 'fund', label: 'Fund', balance: 1000000, observedOn: '2026-10-13', equityPercent: null, bondPercent: null, totalContributions: 500000, totalWithdrawals: 0, cashFlowsConfirmed: true }];
  return data;
}
const scenario: Scenario = { years: 1, annualReturns: {}, monthlyAmounts: {}, transfers: [] };

test('zero return conserves transfers and counts each month of surplus exactly once', () => {
  const data = fixture(), before = structuredClone(data);
  const result = simulate(data, { ...scenario, transfers: [{ fromId: 'bank', toId: 'fund', amount: 200000 }], monthlyAmounts: { fund: 6000 } });
  assert.equal(result.accounts.find(row => row.id === 'fund')!.start, 1200000);
  assert.equal(result.monthlyLeft, 4000);
  assert.deepEqual(result.points.at(-1), { month: 12, total: 1620000, baseline: 1620000, added: 120000, gain: 0, retained: 48000 });
  assert.deepEqual(data, before);
});

test('effective annual return compounds monthly and contributions arrive at month end', () => {
  const result = simulate(fixture(), { ...scenario, annualReturns: { fund: 12 }, monthlyAmounts: { fund: 10000 } });
  const rate = 1.12 ** (1 / 12) - 1;
  const expectedFund = Math.round(1000000 * 1.12 + 10000 * ((1.12 - 1) / rate));
  assert.equal(result.accounts.find(row => row.id === 'fund')!.end, expectedFund);
  assert.equal(result.points.at(-1)!.total, expectedFund + 500000);
  assert.equal(result.points.at(-1)!.baseline, 1740000);
  assert.equal(result.points[0].gain, 0);
  assert.equal(simulate(fixture(), scenario).points.at(-1)!.gain, 0, 'historical gains must not become an annual assumption');
});

test('negative returns remain losses, including a complete loss', () => {
  const data = fixture(); data.income.regularAmount = 0;
  assert.equal(simulate(data, { ...scenario, annualReturns: { fund: -20 } }).points.at(-1)!.gain, -200000);
  assert.equal(simulate(data, { ...scenario, annualReturns: { fund: -100 } }).points.at(-1)!.total, 500000);
});

test('unknown balances, over-allocation, deficits and invalid assumptions cannot produce a projection', () => {
  const data = fixture(); data.cash[0].balance = null; data.cash[0].observedOn = null;
  assert.throws(() => simulate(data, scenario), /Bank.*balance/);
  assert.throws(() => simulate(fixture(), { ...scenario, monthlyAmounts: { fund: 10001 } }), /monthly/i);
  for (const years of [0, 51, 1.5, NaN]) assert.throws(() => simulate(fixture(), { ...scenario, years }));
  for (const value of [-101, 101, Infinity, NaN]) assert.throws(() => simulate(fixture(), { ...scenario, annualReturns: { fund: value } }));
  for (const value of [-1, 0.5, Infinity]) assert.throws(() => simulate(fixture(), { ...scenario, monthlyAmounts: { fund: value } }));
  const deficit = fixture(); deficit.expenses = [{ id: 'cost', label: 'Cost', amount: 20000, frequency: 'monthly', category: 'essential' }];
  assert.throws(() => simulate(deficit, scenario), /costs exceed income/i);
});

test('transfers preserve set-aside cash and reject missing accounts, same-account moves and overdrafts', () => {
  const data = fixture();
  data.cash[0].earmarks = [{ id: 'reserve', label: 'Reserve', amount: 400000, purpose: 'emergency', plannedCostId: null }];
  assert.throws(() => simulate(data, { ...scenario, transfers: [{ fromId: 'bank', toId: 'fund', amount: 100001 }] }), /set aside|available/i);
  for (const transfer of [
    { fromId: 'bank', toId: 'fund', amount: 500001 },
    { fromId: 'bank', toId: 'bank', amount: 1 },
    { fromId: 'missing', toId: 'fund', amount: 1 },
    { fromId: 'bank', toId: 'fund', amount: -1 },
  ]) assert.throws(() => simulate(fixture(), { ...scenario, transfers: [transfer] }));
});

test('unsafe projection magnitudes fail explicitly', () => {
  const data = fixture(); data.portfolios[0].balance = MAX_MONEY;
  assert.throws(() => simulate(data, { ...scenario, years: 50, annualReturns: { fund: 100 } }), /too large/i);
});


test('scenario defaults use each investment gain percentage, rounded like the account table', () => {
  const data = fixture(), before = structuredClone(data);
  assert.equal(createScenario(data).annualReturns.fund, 100);
  data.portfolios[0].balance = 583727;
  assert.equal(createScenario(data).annualReturns.fund, 16.75);
  data.portfolios[0].balance = 400000;
  assert.equal(createScenario(data).annualReturns.fund, -20);
  data.portfolios[0].totalContributions = null;
  assert.equal(createScenario(data).annualReturns.fund, 0);
  assert.equal(createScenario(before).annualReturns.bank, undefined);
  assert.equal(before.portfolios[0].balance, 1000000);
});

test('chart range fits both projections with room for small gains, losses and flat values', () => {
  const base = { month: 0, added: 0, gain: 0, retained: 0 };
  const range = projectionRange([{ ...base, total: 18000000, baseline: 18000000 }, { ...base, month: 12, total: 18200000, baseline: 18100000 }]);
  assert(range.low > 17000000 && range.low < 18000000);
  assert(range.high > 18200000 && range.high < 19000000);
  const loss = projectionRange([{ ...base, total: 18000000, baseline: 18000000 }, { ...base, month: 12, total: 9000000, baseline: 18100000 }]);
  assert(loss.low < 9000000 && loss.high > 18100000);
  for (const value of [0, 100000]) {
    const flat = projectionRange([{ ...base, total: value, baseline: value }]);
    assert(Number.isFinite(flat.low) && flat.low >= 0 && flat.low <= value && flat.high > value);
  }
});
