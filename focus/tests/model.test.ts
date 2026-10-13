import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultFinanceData, FinanceValidationError, migrateFinanceData, parseMoney, formatMoney, formatDate, formatNumber, formatPercent, validateFinanceData } from '../src/finance/model.ts';

test('a new plan validates without inventing observations or financial amounts', () => {
  const data = createDefaultFinanceData('2026-10-12');
  assert.equal(validateFinanceData(data).version, 3);
  assert.equal(data.plan.asOf, '2026-10-12');
  assert.deepEqual(data.cash, []);
  assert.deepEqual(data.portfolios, []);
  assert.equal(data.income.regularAmount, 0);
  assert.equal(data.income.annualRealGrowthPercent, 0);
  assert.equal(data.plan.setupCompleted, false);
  assert.deepEqual(data.plan.allocations, []);
});

test('migration validates current data and refuses unsupported versions instead of resetting it', () => {
  const data = createDefaultFinanceData('2026-10-12');
  assert.deepEqual(migrateFinanceData(data), data);
  for (const version of [0, 4, '1', '2', undefined]) {
    assert.throws(() => migrateFinanceData({ ...data, version }), FinanceValidationError);
  }
});

test('v1 migration validates the original schema and leaves historical income unknown', () => {
  const current = createDefaultFinanceData('2026-10-12');
  const legacy = { ...current, version: 1, income: { regularAmount: 123450, paymentsPerYear: 14, extraPayments: [{ id: 'extra', label: 'Extra', amount: 10000 }] }, snapshots: [{ id: 's', date: '2026-01-01', cash: [], portfolios: [], debts: [] }] };
  const before = structuredClone(legacy);
  const migrated = migrateFinanceData(legacy);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.income.regularAmount, 123450);
  assert.equal(migrated.income.annualRealGrowthPercent, 0);
  assert.equal(migrated.snapshots[0].incomeAnnual, null);
  assert.deepEqual(migrateFinanceData(migrated), migrated);
  assert.deepEqual(legacy, before);
  for (const invalid of [
    { ...legacy, income: { ...legacy.income, annualRealGrowthPercent: 0 } },
    { ...legacy, income: { ...legacy.income, regularAmount: -1 } },
    { ...legacy, snapshots: [{ ...legacy.snapshots[0], incomeAnnual: 10000 }] },
    { ...legacy, plan: { ...legacy.plan, unknown: true } },
  ]) assert.throws(() => migrateFinanceData(invalid), FinanceValidationError);
  assert.throws(() => validateFinanceData(legacy), FinanceValidationError);
});

test('the current schema retains a bounded income assumption and exact annual-income observations', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.snapshots = [{ id: 's', date: '2026-01-01', incomeAnnual: null, cash: [], portfolios: [], debts: [] }];
  for (const value of [-51, 51, Infinity, NaN, undefined]) {
    assert.throws(() => validateFinanceData({ ...data, income: { ...data.income, annualRealGrowthPercent: value } }), FinanceValidationError);
  }
  for (const incomeAnnual of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined]) {
    assert.throws(() => validateFinanceData({ ...data, snapshots: [{ ...data.snapshots[0], incomeAnnual }] }), FinanceValidationError);
  }
  data.income.annualRealGrowthPercent = -50;
  data.snapshots[0].incomeAnnual = 0;
  validateFinanceData(data);
  data.income.annualRealGrowthPercent = 50;
  data.snapshots[0].incomeAnnual = 500_000_000_000_000;
  validateFinanceData(data);
});

test('all nested structures reject unknown fields and malformed values', () => {
  const fixtures: ((data: any) => void)[] = [
    data => { data.extra = true; },
    data => { data.currency = 'JPY'; },
    data => { data.income.extra = true; },
    data => { data.income.regularAmount = 1.5; },
    data => { data.income.paymentsPerYear = Infinity; },
    data => { data.income.extraPayments = [{ id: 'x', label: 'Bonus', amount: -1 }]; },
    data => { data.plan.asOf = '2026-02-30'; },
    data => { data.plan.horizonYears = 101; },
    data => { data.plan.lockAfterMinutes = 0; },
    data => { data.plan.reviewEveryMonths = -1; },
    data => { data.fire.annualRealReturnPercent = -100; },
    data => { data.fire.annualRealReturnPercent = NaN; },
    data => { data.fire.withdrawalRatePercent = 0; },
    data => { data.fire.contributionMode = 'combined'; },
    data => { data.cash = [{ id: 'c', label: 'Cash', balance: 10, observedOn: '2026-10-13', earmarks: [] }]; },
    data => { data.expenses = [{ id: 'e', label: 'Rent', amount: 10, frequency: 'weekly', category: 'essential' }]; },
    data => { data.irregularExpenses = [{ id: 'i', label: 'Insurance', annualAmount: 10, essential: 'yes' }]; },
  ];
  for (const mutate of fixtures) {
    const data = createDefaultFinanceData('2026-10-12');
    mutate(data);
    assert.throws(() => validateFinanceData(data), FinanceValidationError);
  }
});

test('derived financial commitments cannot exceed exact integer arithmetic', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.fire.retirementMonthlySpending = 1_000_000_000_000;
  data.fire.withdrawalRatePercent = 0.1;
  assert.throws(() => validateFinanceData(data), /precision/);
  data.fire.retirementMonthlySpending = 0;
  data.fire.costs = Array.from({ length: 10 }, (_, i) => ({ id: `cost-${i}`, label: 'Monthly', amount: 1_000_000_000_000, startsOn: '1900-01-01', endsOn: '2199-12-31', frequency: 'monthly' as const, earmarkId: null }));
  assert.throws(() => validateFinanceData(data), /precision/);
});

test('included debt payments require sufficient essential recurring costs, not irregular provisions', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.debts = [{ id: 'd', label: 'Debt', balance: 10000, observedOn: '2026-10-12', annualRatePercent: 0, rateConvention: 'nominal', variableAssumption: false, monthlyPayment: 10000, includedInBaseline: true }];
  assert.throws(() => validateFinanceData(data), /essential recurring/i);
  data.irregularExpenses = [{ id: 'i', label: 'Repairs', annualAmount: 120000, essential: true }];
  assert.throws(() => validateFinanceData(data), /essential recurring/i);
  data.expenses = [{ id: 'e', label: 'Loan payment', amount: 10000, frequency: 'monthly', category: 'essential' }];
  validateFinanceData(data);
});

test('salary payment counts support weekly and fortnightly pay', () => {
  const data = createDefaultFinanceData('2026-10-12');
  for (const count of [26, 52, 366]) { data.income.paymentsPerYear = count; validateFinanceData(data); }
  data.income.paymentsPerYear = 367;
  assert.throws(() => validateFinanceData(data), /paymentsPerYear/);
});

test('cash earmarks are disjoint, bounded by observed cash and linked to one real planned cost', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.fire.costs = [{ id: 'car', label: 'Car', amount: 10000, startsOn: '2027-01-01', endsOn: null, frequency: 'once', earmarkId: 'car-fund' }];
  data.cash = [{ id: 'bank', label: 'Bank', balance: 20000, observedOn: '2026-10-12', earmarks: [
    { id: 'reserve', label: 'Reserve', amount: 10000, purpose: 'emergency', plannedCostId: null },
    { id: 'car-fund', label: 'Car fund', amount: 10000, purpose: 'planned', plannedCostId: 'car' },
  ] }];
  validateFinanceData(data);
  const excess = structuredClone(data);
  excess.cash[0].earmarks[0].amount++;
  assert.throws(() => validateFinanceData(excess), /earmark/i);
  const unlinked = structuredClone(data);
  unlinked.cash[0].earmarks[1].plannedCostId = 'missing';
  assert.throws(() => validateFinanceData(unlinked), FinanceValidationError);
  const reused = structuredClone(data);
  reused.fire.costs.push({ ...reused.fire.costs[0], id: 'car2' });
  assert.throws(() => validateFinanceData(reused), /earmark/i);
  const orphaned = structuredClone(data);
  orphaned.fire.costs[0].earmarkId = null;
  assert.throws(() => validateFinanceData(orphaned), /earmark/i);
});

test('observed balances keep missing distinct from zero and percentages must sum to 100', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.portfolios = [{ id: 'p', label: 'Portfolio', balance: null, observedOn: null, equityPercent: null, bondPercent: null, totalContributions: null, totalWithdrawals: null, cashFlowsConfirmed: false }];
  validateFinanceData(data);
  data.portfolios[0].observedOn = '2026-10-12';
  assert.throws(() => validateFinanceData(data), /observedOn/);
  data.portfolios[0].balance = 0;
  data.portfolios[0].equityPercent = 60;
  data.portfolios[0].bondPercent = 30;
  assert.throws(() => validateFinanceData(data), /100/);
  data.portfolios[0].bondPercent = 40;
  validateFinanceData(data);
});

test('debt rates, dated costs, snapshot rows and rule targets are validated', () => {
  const data = createDefaultFinanceData('2026-10-12');
  data.debts = [{ id: 'd', label: 'Loan', balance: 1000, observedOn: '2026-10-12', annualRatePercent: 4, rateConvention: 'nominal', variableAssumption: false, monthlyPayment: 100, includedInBaseline: false }];
  data.plan.allocations = [{ id: 'r', kind: 'debt', amount: 50, targetId: 'd' }];
  data.snapshots = [{ id: 's', date: '2026-10-12', incomeAnnual: null, cash: [], portfolios: [], debts: [{ id: 'd', balance: 1000, observedOn: '2026-10-12' }] }];
  validateFinanceData(data);
  for (const mutate of [
    (copy: any) => { copy.debts[0].rateConvention = 'guess'; },
    (copy: any) => { copy.debts[0].annualRatePercent = 101; },
    (copy: any) => { copy.plan.allocations[0].targetId = 'gone'; },
    (copy: any) => { copy.snapshots[0].debts[0].private = true; },
    (copy: any) => { copy.fire.costs = [{ id: 'c', label: 'Cost', amount: 10, startsOn: '2027-02-01', endsOn: '2027-01-01', frequency: 'monthly', earmarkId: null }]; },
  ]) {
    const copy = structuredClone(data);
    mutate(copy);
    assert.throws(() => validateFinanceData(copy), FinanceValidationError);
  }
});

test('money parsing supports a decimal comma without accepting ambiguous grouping or fractional hundredths', () => {
  assert.equal(parseMoney(' 1234,50 '), 123450);
  assert.equal(parseMoney('1234.5'), 123450);
  assert.equal(parseMoney('0'), 0);
  for (const value of ['1,234', '1.234', '1,234.50', '1.234,50', 'NaN', '-1', '1e4', '', '1 000']) {
    assert.throws(() => parseMoney(value), FinanceValidationError);
  }
  assert.equal(formatMoney(123450, 'EUR'), '1.234,50€');
});

test('whole-unit summaries leave stored precision available for editing and inspection', () => {
  const amount = parseMoney('1234,56');
  assert.equal(formatMoney(amount, 'EUR', 0), '1.235€');
  assert.equal(formatMoney(amount, 'EUR'), '1.234,56€');
  assert.equal(amount, 123456);
  assert.equal(formatMoney(25, 'EUR', 0), '0,25€');
  assert.equal(formatMoney(-25, 'EUR', 0), '-0,25€');
  assert.equal(formatMoney(-123456, 'EUR'), '-1.234,56€');
  assert.equal(formatMoney(0, 'EUR', 0), '0€');
  assert.equal(formatMoney(111700, 'EUR', 0), '1.117€');
  assert.equal(formatMoney(123456, 'USD'), '1.234,56$');
});

test('calendar dates use English ordinals without shifting the saved day across time zones', () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = timezone;
      for (const [date, expected] of [
        ['2067-10-31', '31st October 2067'], ['2028-02-29', '29th February 2028'],
        ['2026-01-01', '1st January 2026'], ['2026-01-02', '2nd January 2026'],
        ['2026-01-03', '3rd January 2026'], ['2026-01-11', '11th January 2026'],
        ['2026-01-12', '12th January 2026'], ['2026-01-13', '13th January 2026'],
        ['2026-01-21', '21st January 2026'], ['2026-01-22', '22nd January 2026'],
        ['2026-01-23', '23rd January 2026'],
      ]) assert.equal(formatDate(date), expected);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('percentages and ages use decimal commas without scaling the stored percentage', () => {
  assert.equal(formatPercent(4.5), '4,5%');
  assert.equal(formatPercent(-1.25), '-1,25%');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(100), '100%');
  assert.equal(formatPercent(0.001), '<0,01%');
  assert.equal(formatPercent(-0.001), '>-0,01%');
  assert.equal(formatPercent(0.005), '0,01%');
  assert.equal(formatNumber(65.5, 1), '65,5');
  assert.equal(formatNumber(65, 1), '65,0');
  assert.equal(formatNumber(1117), '1.117');
});
