import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultFinanceData, type Debt } from '../src/finance/model.ts';
import { annualIncome, calculateOverview, monthlyBreakdown } from '../src/finance/calculations.ts';

function plan() {
  const data = createDefaultFinanceData('2026-10-12');
  data.income.regularAmount = 300000;
  data.expenses = [{ id: 'rent', label: 'Rent', amount: 100000, frequency: 'monthly', category: 'essential' }];
  return data;
}
function loan(overrides: Partial<Debt> = {}): Debt {
  return { id: 'loan', label: 'Loan', balance: 120000, observedOn: '2026-10-12', annualRatePercent: 0, rateConvention: 'nominal', variableAssumption: false, monthlyPayment: 10000, includedInBaseline: false, ...overrides };
}

test('annualises salary, unequal extra payments and yearly costs without counting a loan payment twice', () => {
  const data = plan();
  data.income.paymentsPerYear = 14;
  data.income.extraPayments = [{ id: 'bonus', label: 'Bonus', amount: 60000 }];
  data.expenses.push({ id: 'annual', label: 'Insurance', amount: 120000, frequency: 'annual', category: 'essential' });
  data.irregularExpenses = [{ id: 'irregular', label: 'Repairs', annualAmount: 240000, essential: true }];
  data.debts = [loan({ includedInBaseline: true })];
  const overview = calculateOverview(data);
  assert.equal(annualIncome(data), 4260000);
  assert.equal(overview.incomeMonthly, 355000);
  assert.equal(overview.expensesMonthly, 130000);
  assert.equal(overview.requiredDebtMonthly, 10000);
  assert.equal(overview.additionalDebtMonthly, 0);
  assert.equal(overview.surplusMonthly, 225000);
  data.debts[0].includedInBaseline = false;
  assert.equal(calculateOverview(data).surplusMonthly, 215000);
});

test('cash set aside is a portion of cash and investments are separate assets', () => {
  const data = plan();
  data.cash = [{ id: 'bank', label: 'Bank', balance: 100000, observedOn: '2026-10-12', earmarks: [{ id: 'reserve', label: 'Reserve', amount: 75000, purpose: 'emergency', plannedCostId: null }] }];
  data.portfolios = [{ id: 'fund', label: 'Fund', balance: 200000, observedOn: '2026-10-12', equityPercent: null, bondPercent: null, totalContributions: 150000, totalWithdrawals: null, cashFlowsConfirmed: false }];
  data.debts = [loan()];
  const overview = calculateOverview(data);
  assert.equal(overview.cashTotal, 100000);
  assert.equal(overview.earmarkedCash, 75000);
  assert.equal(overview.unearmarkedCash, 25000);
  assert.equal(overview.netWorth, 180000);
  assert.equal(overview.portfolioTotal, 200000);
});

test('retired FIRE scenarios, allocation rules and income growth have no effect and are preserved', () => {
  const data = plan();
  const current = calculateOverview(data);
  data.income.annualRealGrowthPercent = 50;
  data.fire.monthlyContribution = 190000;
  data.fire.contributionMode = 'manual';
  data.fire.retirementMonthlySpending = 400000;
  data.fire.costs = [{ id: 'old', label: 'Old scenario', amount: 50000, startsOn: '2026-10-12', endsOn: null, frequency: 'monthly', earmarkId: null }];
  data.plan.allocations = [{ id: 'old-rule', kind: 'invest', amount: 180000, targetId: null }];
  const before = structuredClone(data);
  assert.deepEqual(calculateOverview(data), current);
  assert.deepEqual(data, before);
});

test('deficits stay negative instead of inventing money available to save', () => {
  const data = plan();
  data.income.regularAmount = 50000;
  const result = calculateOverview(data);
  assert.equal(result.surplusMonthly, -50000);
  assert.equal(result.deficitMonthly, 50000);
});

test('final and paid-off loan payments adjust included spending only once', () => {
  const data = plan();
  data.debts = [loan({ balance: 2500, includedInBaseline: true })];
  assert.equal(calculateOverview(data).expensesMonthly, 92500);
  assert.equal(calculateOverview(data).additionalDebtMonthly, 0);
  data.debts[0].includedInBaseline = false;
  assert.equal(calculateOverview(data).additionalDebtMonthly, 2500);
  data.debts[0].balance = 0;
  assert.equal(calculateOverview(data).additionalDebtMonthly, 0);
});

test('monthly interest respects the entered convention and flags payments that do not reduce debt', () => {
  const data = plan();
  data.debts = [loan({ balance: 100000, monthlyPayment: 200000, annualRatePercent: 12 })];
  assert.equal(calculateOverview(data).requiredDebtMonthly, 101000);
  data.debts[0].rateConvention = 'effective';
  assert.equal(calculateOverview(data).requiredDebtMonthly, 100949);
  data.debts[0].monthlyPayment = 949;
  assert.match(calculateOverview(data).warnings.join(' '), /does not reduce the balance/);
  data.debts[0].balance = 0;
  assert.deepEqual(calculateOverview(data).warnings, []);
});

test('unknown and stale balances remain distinguishable from zero and are never projected forward', () => {
  const data = plan();
  data.cash = [{ id: 'bank', label: 'Bank', balance: null, observedOn: null, earmarks: [] }];
  data.portfolios = [{ id: 'fund', label: 'Fund', balance: 150000, observedOn: '2025-01-01', equityPercent: null, bondPercent: null, totalContributions: null, totalWithdrawals: null, cashFlowsConfirmed: false }];
  const before = structuredClone(data);
  const result = calculateOverview(data);
  assert.deepEqual(result.missingObservations, ['Bank']);
  assert.equal(result.netWorth, 150000);
  assert.deepEqual(data, before);
});

test('monthly estimates round to hundredths after annual normalization', () => {
  const data = plan();
  data.income.regularAmount = 100001;
  data.income.paymentsPerYear = 14;
  data.income.extraPayments = [{ id: 'extra', label: 'Extra', amount: 99999 }];
  assert.equal(annualIncome(data), 1500013);
  assert.equal(calculateOverview(data).incomeMonthly, 125001);
});

test('monthly breakdown reconciles yearly rounding and included loan adjustments', () => {
  const data = plan();
  data.income.paymentsPerYear = 14;
  data.income.extraPayments = [{ id: 'extra', label: 'Bonus', amount: 101 }];
  data.expenses.push({ id: 'yearly', label: 'Insurance', amount: 101, frequency: 'annual', category: 'essential' });
  data.irregularExpenses = [{ id: 'repair', label: 'Repairs', annualAmount: 101, essential: true }];
  data.debts = [loan({ balance: 2500, includedInBaseline: true }), loan({ id: 'second', label: 'Car', balance: 3000 })];
  const before = structuredClone(data);
  const rows = monthlyBreakdown(data);
  const overview = calculateOverview(data);
  assert.deepEqual(rows.income.map(row => row.label), ['Salary', 'Bonus']);
  assert.equal(rows.income.reduce((total, row) => total + row.amount, 0), overview.incomeMonthly);
  assert.equal(rows.costs.reduce((total, row) => total + row.amount, 0), overview.expensesMonthly + overview.additionalDebtMonthly);
  assert.equal(rows.costs.find(row => row.label === 'Car')?.amount, 3000);
  assert.equal(rows.costs.find(row => row.label === 'Loan · payment adjustment')?.amount, -7500);
  assert.deepEqual(data, before);
});
