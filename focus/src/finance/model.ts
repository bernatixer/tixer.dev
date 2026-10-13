export const FINANCE_VERSION = 3 as const;
export const MAX_MONEY = 1_000_000_000_000;

export interface ExtraPayment { id: string; label: string; amount: number }
export interface Expense { id: string; label: string; amount: number; frequency: 'monthly' | 'annual'; category: 'essential' | 'discretionary' }
export interface IrregularExpense { id: string; label: string; annualAmount: number; essential: boolean }
export interface Earmark { id: string; label: string; amount: number; purpose: 'emergency' | 'planned' | 'other'; plannedCostId: string | null }
export interface CashAccount { id: string; label: string; balance: number | null; observedOn: string | null; earmarks: Earmark[] }
export interface Portfolio { id: string; label: string; balance: number | null; observedOn: string | null; equityPercent: number | null; bondPercent: number | null; totalContributions: number | null; totalWithdrawals: number | null; cashFlowsConfirmed: boolean }
export interface Debt { id: string; label: string; balance: number; observedOn: string; annualRatePercent: number; rateConvention: 'nominal' | 'effective'; variableAssumption: boolean; monthlyPayment: number; includedInBaseline: boolean }
export interface AllocationRule { id: string; kind: 'reserve' | 'planned' | 'debt' | 'retain' | 'invest'; amount: number; targetId: string | null }
export interface PlannedCost { id: string; label: string; amount: number; startsOn: string; endsOn: string | null; frequency: 'once' | 'monthly'; earmarkId: string | null }
export interface BalanceObservation { id: string; balance: number | null; observedOn: string | null }
export interface PortfolioObservation extends BalanceObservation { totalContributions: number | null; totalWithdrawals: number | null; cashFlowsConfirmed: boolean }
export interface Snapshot { id: string; date: string; incomeAnnual: number | null; cash: BalanceObservation[]; portfolios: PortfolioObservation[]; debts: { id: string; balance: number; observedOn: string }[] }
// boffin: Retain retired planning fields so v2 encrypted backups keep their data.
export interface FinanceData {
  version: typeof FINANCE_VERSION;
  currency: string;
  income: { regularAmount: number; paymentsPerYear: number; extraPayments: ExtraPayment[]; annualRealGrowthPercent: number };
  expenses: Expense[];
  irregularExpenses: IrregularExpense[];
  cash: CashAccount[];
  portfolios: Portfolio[];
  debts: Debt[];
  plan: { asOf: string; age: number; horizonYears: number; reviewEveryMonths: number; reserveMonths: number; policyNotes: string; lockAfterMinutes: number; setupCompleted: boolean; allocations: AllocationRule[] };
  fire: { contributionMode: 'suggested' | 'manual'; monthlyContribution: number; annualRealReturnPercent: number; retirementMonthlySpending: number; withdrawalRatePercent: number; costs: PlannedCost[] };
  snapshots: Snapshot[];
}
type LegacyPortfolio = Omit<Portfolio, 'totalWithdrawals' | 'cashFlowsConfirmed'>;
type LegacySnapshot = Omit<Snapshot, 'portfolios'> & { portfolios: Omit<PortfolioObservation, 'totalWithdrawals' | 'cashFlowsConfirmed'>[] };
type LegacyFinanceData = Omit<FinanceData, 'version' | 'portfolios' | 'snapshots'> & { version: 2; portfolios: LegacyPortfolio[]; snapshots: LegacySnapshot[] };
type V1FinanceData = Omit<LegacyFinanceData, 'version' | 'income' | 'snapshots'> & {
  version: 1;
  income: Omit<FinanceData['income'], 'annualRealGrowthPercent'>;
  snapshots: Omit<LegacySnapshot, 'incomeAnnual'>[];
};

export class FinanceValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'FinanceValidationError';
    this.path = path;
  }
}

function fail(path: string, message: string): never { throw new FinanceValidationError(path, message); }
function object(value: unknown, path: string, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(path, 'expected an object');
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) if (!fields.includes(key)) fail(`${path}.${key}`, 'unknown field');
  for (const key of fields) if (!Object.prototype.hasOwnProperty.call(record, key)) fail(`${path}.${key}`, 'missing field');
  return record;
}
function array(value: unknown, path: string, max = 120): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `expected an array with at most ${max} entries`);
  return value;
}
function number(value: unknown, path: string, min: number, max: number, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) fail(path, `expected ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}`);
}
function money(value: unknown, path: string) { number(value, path, 0, MAX_MONEY, true); }
function text(value: unknown, path: string, max = 120, empty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(path, `expected ${empty ? 'text' : 'nonempty text'} of at most ${max} characters`);
}
function id(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) fail(path, 'expected an identifier of at most 64 letters, digits, underscores or hyphens');
}
function choice(value: unknown, path: string, values: readonly string[]) {
  if (typeof value !== 'string' || !values.includes(value)) fail(path, `expected ${values.join(' or ')}`);
}
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') fail(path, 'expected true or false'); }
function date(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !/^(19|20|21)\d\d-\d\d-\d\d$/.test(value)) fail(path, 'expected a calendar date from 1900 to 2199 (YYYY-MM-DD)');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(path, 'invalid calendar date');
}
function rows(value: unknown, path: string, fields: string[], validate: (row: Record<string, unknown>, path: string) => void, max = 120) {
  const ids = new Set<string>();
  return array(value, path, max).map((entry, index) => {
    const p = `${path}[${index}]`;
    const row = object(entry, p, fields);
    id(row.id, `${p}.id`);
    if (ids.has(row.id)) fail(`${p}.id`, 'duplicate identifier');
    ids.add(row.id);
    validate(row, p);
    return row;
  });
}
function labelled(row: Record<string, unknown>, path: string) { text(row.label, `${path}.label`); }
function observed(row: Record<string, unknown>, path: string, latest: string, nullable = true) {
  if (nullable && row.balance === null) {
    if (row.observedOn !== null) fail(`${path}.observedOn`, 'a missing balance must have a missing observation date');
  } else {
    money(row.balance, `${path}.balance`);
    date(row.observedOn, `${path}.observedOn`);
    if (row.observedOn > latest) fail(`${path}.observedOn`, 'observation is after the plan or snapshot date');
  }
}

function validateCashFlows(row: Record<string, unknown>, path: string, version: number) {
  if (row.totalContributions !== null) money(row.totalContributions, `${path}.totalContributions`);
  if (version < 3) return;
  if (row.totalWithdrawals !== null) money(row.totalWithdrawals, `${path}.totalWithdrawals`);
  bool(row.cashFlowsConfirmed, `${path}.cashFlowsConfirmed`);
  if (row.cashFlowsConfirmed && (row.balance === null || row.totalContributions === null || row.totalWithdrawals === null)) fail(path, 'enter a balance and both money totals before confirming them');
}

function validateSchema(input: unknown, version: 1): V1FinanceData;
function validateSchema(input: unknown, version: 2): LegacyFinanceData;
function validateSchema(input: unknown, version: 3): FinanceData;
function validateSchema(input: unknown, version: 1 | 2 | 3): V1FinanceData | LegacyFinanceData | FinanceData {
  const data = object(input, 'finance', ['version', 'currency', 'income', 'expenses', 'irregularExpenses', 'cash', 'portfolios', 'debts', 'plan', 'fire', 'snapshots']);
  if (data.version !== version) fail('finance.version', 'unsupported schema version');
  if (typeof data.currency !== 'string' || !['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN'].includes(data.currency)) fail('finance.currency', 'expected a supported two-decimal currency: EUR, USD, GBP, CHF, CAD, AUD, SEK, NOK, DKK or PLN');
  const income = object(data.income, 'income', ['regularAmount', 'paymentsPerYear', 'extraPayments', ...(version >= 2 ? ['annualRealGrowthPercent'] : [])]);
  money(income.regularAmount, 'income.regularAmount');
  number(income.paymentsPerYear, 'income.paymentsPerYear', 1, 366, true);
  if (version >= 2) number(income.annualRealGrowthPercent, 'income.annualRealGrowthPercent', -50, 50);
  rows(income.extraPayments, 'income.extraPayments', ['id', 'label', 'amount'], (row, p) => { labelled(row, p); money(row.amount, `${p}.amount`); });
  const plan = object(data.plan, 'plan', ['asOf', 'age', 'horizonYears', 'reviewEveryMonths', 'reserveMonths', 'policyNotes', 'lockAfterMinutes', 'setupCompleted', 'allocations']);
  date(plan.asOf, 'plan.asOf');
  const asOf = plan.asOf;
  number(plan.age, 'plan.age', 0, 120, true);
  number(plan.horizonYears, 'plan.horizonYears', 1, 80, true);
  if ((plan.age as number) + (plan.horizonYears as number) > 120) fail('plan.horizonYears', 'age plus horizon must not exceed 120');
  number(plan.reviewEveryMonths, 'plan.reviewEveryMonths', 0, 60, true);
  number(plan.reserveMonths, 'plan.reserveMonths', 0, 60);
  text(plan.policyNotes, 'plan.policyNotes', 4000, true);
  number(plan.lockAfterMinutes, 'plan.lockAfterMinutes', 1, 60, true);
  bool(plan.setupCompleted, 'plan.setupCompleted');
  rows(data.expenses, 'expenses', ['id', 'label', 'amount', 'frequency', 'category'], (row, p) => {
    labelled(row, p); money(row.amount, `${p}.amount`); choice(row.frequency, `${p}.frequency`, ['monthly', 'annual']); choice(row.category, `${p}.category`, ['essential', 'discretionary']);
  });
  rows(data.irregularExpenses, 'irregularExpenses', ['id', 'label', 'annualAmount', 'essential'], (row, p) => { labelled(row, p); money(row.annualAmount, `${p}.annualAmount`); bool(row.essential, `${p}.essential`); });
  const earmarks = new Map<string, { purpose: unknown; plannedCostId: unknown }>();
  rows(data.cash, 'cash', ['id', 'label', 'balance', 'observedOn', 'earmarks'], (row, p) => {
    labelled(row, p); observed(row, p, asOf);
    let total = 0;
    rows(row.earmarks, `${p}.earmarks`, ['id', 'label', 'amount', 'purpose', 'plannedCostId'], (mark, mp) => {
      labelled(mark, mp); money(mark.amount, `${mp}.amount`); choice(mark.purpose, `${mp}.purpose`, version === 3 ? ['emergency', 'planned', 'other'] : ['emergency', 'planned']);
      if (mark.purpose !== 'planned' && mark.plannedCostId !== null) fail(`${mp}.plannedCostId`, 'only a linked planned earmark can fund a planned cost');
      if (mark.purpose === 'planned') id(mark.plannedCostId, `${mp}.plannedCostId`);
      if (earmarks.has(mark.id as string)) fail(`${mp}.id`, 'duplicate earmark identifier');
      earmarks.set(mark.id as string, { purpose: mark.purpose, plannedCostId: mark.plannedCostId });
      total += mark.amount as number;
    });
    if (total > (row.balance === null ? 0 : row.balance as number)) fail(`${p}.earmarks`, 'earmark total exceeds observed cash');
  });
  rows(data.portfolios, 'portfolios', ['id', 'label', 'balance', 'observedOn', 'equityPercent', 'bondPercent', 'totalContributions', ...(version === 3 ? ['totalWithdrawals', 'cashFlowsConfirmed'] : [])], (row, p) => {
    labelled(row, p); observed(row, p, asOf);
    if (row.equityPercent !== null || row.bondPercent !== null) {
      number(row.equityPercent, `${p}.equityPercent`, 0, 100);
      number(row.bondPercent, `${p}.bondPercent`, 0, 100);
      if (Math.abs(row.equityPercent + row.bondPercent - 100) > 0.000001) fail(`${p}.equityPercent`, 'equity and bond percentages must sum to 100');
    }
    validateCashFlows(row, p, version);
  });
  const debts = rows(data.debts, 'debts', ['id', 'label', 'balance', 'observedOn', 'annualRatePercent', 'rateConvention', 'variableAssumption', 'monthlyPayment', 'includedInBaseline'], (row, p) => {
    labelled(row, p); observed(row, p, asOf, false);
    number(row.annualRatePercent, `${p}.annualRatePercent`, 0, 100);
    choice(row.rateConvention, `${p}.rateConvention`, ['nominal', 'effective']);
    bool(row.variableAssumption, `${p}.variableAssumption`); bool(row.includedInBaseline, `${p}.includedInBaseline`);
    money(row.monthlyPayment, `${p}.monthlyPayment`);
  });
  const fire = object(data.fire, 'fire', ['contributionMode', 'monthlyContribution', 'annualRealReturnPercent', 'retirementMonthlySpending', 'withdrawalRatePercent', 'costs']);
  choice(fire.contributionMode, 'fire.contributionMode', ['suggested', 'manual']);
  money(fire.monthlyContribution, 'fire.monthlyContribution');
  number(fire.annualRealReturnPercent, 'fire.annualRealReturnPercent', -99, 100);
  money(fire.retirementMonthlySpending, 'fire.retirementMonthlySpending');
  number(fire.withdrawalRatePercent, 'fire.withdrawalRatePercent', 0.1, 100);
  const usedEarmarks = new Set<string>();
  const costs = rows(fire.costs, 'fire.costs', ['id', 'label', 'amount', 'startsOn', 'endsOn', 'frequency', 'earmarkId'], (row, p) => {
    labelled(row, p); money(row.amount, `${p}.amount`); date(row.startsOn, `${p}.startsOn`);
    choice(row.frequency, `${p}.frequency`, ['once', 'monthly']);
    if (row.endsOn !== null) {
      date(row.endsOn, `${p}.endsOn`);
      if (row.endsOn < row.startsOn) fail(`${p}.endsOn`, 'end date precedes start date');
      if (row.frequency === 'once') fail(`${p}.endsOn`, 'a one-off cost has no end date');
    }
    if (row.earmarkId !== null) {
      id(row.earmarkId, `${p}.earmarkId`);
      const mark = earmarks.get(row.earmarkId);
      if (!mark || mark.purpose !== 'planned' || mark.plannedCostId !== row.id || usedEarmarks.has(row.earmarkId)) fail(`${p}.earmarkId`, 'earmark must be reserved exclusively for this planned cost');
      usedEarmarks.add(row.earmarkId);
    }
  });
  const costsById = new Map(costs.map(row => [row.id, row]));
  for (const [markId, mark] of earmarks) if (mark.purpose === 'planned') {
    const cost = costsById.get(mark.plannedCostId);
    if (!cost) fail(`earmarks.${markId}.plannedCostId`, 'planned cost does not exist');
    if (cost.earmarkId !== markId) fail(`earmarks.${markId}.plannedCostId`, 'planned earmark must also be selected by its cost');
  }
  rows(plan.allocations, 'plan.allocations', ['id', 'kind', 'amount', 'targetId'], (row, p) => {
    choice(row.kind, `${p}.kind`, ['reserve', 'planned', 'debt', 'retain', 'invest']); money(row.amount, `${p}.amount`);
    if (row.kind === 'planned' || row.kind === 'debt') {
      id(row.targetId, `${p}.targetId`);
      const targets = row.kind === 'planned' ? costs : debts;
      if (!targets.some(target => target.id === row.targetId)) fail(`${p}.targetId`, 'target does not exist');
    } else if (row.targetId !== null) fail(`${p}.targetId`, 'this rule has no target');
  });
  rows(data.snapshots, 'snapshots', ['id', 'date', 'cash', 'portfolios', 'debts', ...(version >= 2 ? ['incomeAnnual'] : [])], (row, p) => {
    date(row.date, `${p}.date`);
    if (row.date > asOf) fail(`${p}.date`, 'snapshot is after the plan date');
    if (version >= 2 && row.incomeAnnual !== null) number(row.incomeAnnual, `${p}.incomeAnnual`, 0, Number.MAX_SAFE_INTEGER, true);
    const latest = row.date;
    rows(row.cash, `${p}.cash`, ['id', 'balance', 'observedOn'], (entry, ep) => observed(entry, ep, latest));
    rows(row.portfolios, `${p}.portfolios`, ['id', 'balance', 'observedOn', 'totalContributions', ...(version === 3 ? ['totalWithdrawals', 'cashFlowsConfirmed'] : [])], (entry, ep) => { observed(entry, ep, latest); validateCashFlows(entry, ep, version); });
    rows(row.debts, `${p}.debts`, ['id', 'balance', 'observedOn'], (entry, ep) => observed(entry, ep, latest, false));
  }, 240);
  const validated = data as unknown as V1FinanceData | LegacyFinanceData | FinanceData;
  const essentialRecurringAnnual = validated.expenses.filter(expense => expense.category === 'essential').reduce((total, expense) => total + expense.amount * (expense.frequency === 'monthly' ? 12 : 1), 0);
  const includedPayments = validated.debts.filter(debt => debt.includedInBaseline).reduce((total, debt) => total + debt.monthlyPayment, 0);
  if (includedPayments * 12 > essentialRecurringAnnual) fail('debts.includedInBaseline', 'included monthly payments must already fit essential recurring expenses, excluding irregular provisions');
  const safeAmount = (value: number, path: string) => { if (!Number.isSafeInteger(Math.round(value))) fail(path, 'combined amount exceeds exact integer precision'); };
  safeAmount(validated.fire.retirementMonthlySpending * 12 / (validated.fire.withdrawalRatePercent / 100), 'fire.retirementMonthlySpending');
  const essentialAnnual = essentialRecurringAnnual + validated.irregularExpenses.filter(expense => expense.essential).reduce((total, expense) => total + expense.annualAmount, 0);
  safeAmount((Math.round(essentialAnnual / 12) + validated.debts.filter(debt => !debt.includedInBaseline).reduce((total, debt) => total + debt.monthlyPayment, 0)) * validated.plan.reserveMonths, 'plan.reserveMonths');
  const monthNumber = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  const finiteCommitments = validated.fire.costs.reduce((total, cost) => {
    if (cost.frequency === 'once') return total + (cost.startsOn >= asOf ? cost.amount : 0);
    if (cost.endsOn === null || cost.endsOn < asOf) return total;
    return total + Math.max(0, monthNumber(cost.endsOn) - Math.max(monthNumber(asOf), monthNumber(cost.startsOn)) + 1) * cost.amount;
  }, 0);
  safeAmount(finiteCommitments, 'fire.costs');
  if (new TextEncoder().encode(JSON.stringify(data)).length > 262144) fail('finance', 'plan exceeds the 256 KiB plaintext limit');
  return validated;
}

export function validateFinanceData(input: unknown): FinanceData {
  return validateSchema(input, FINANCE_VERSION);
}

export function migrateFinanceData(input: unknown): FinanceData {
  const version = input && typeof input === 'object' ? (input as { version?: unknown }).version : undefined;
  if (version === 3) return validateFinanceData(input);
  if (version === 1) {
    const legacy = validateSchema(input, 1);
    return migrateFinanceData({ ...legacy, version: 2, income: { ...legacy.income, annualRealGrowthPercent: 0 }, snapshots: legacy.snapshots.map(snapshot => ({ ...snapshot, incomeAnnual: null })) });
  }
  if (version !== 2) fail('finance.version', 'unsupported schema version');
  const legacy = validateSchema(input, 2);
  // boffin: Missing withdrawal history stays unknown; old balances cannot imply gains.
  const upgrade = <T extends { totalContributions: number | null }>(row: T) => ({ ...row, totalWithdrawals: null, cashFlowsConfirmed: false });
  return validateFinanceData({ ...legacy, version: 3, portfolios: legacy.portfolios.map(upgrade), snapshots: legacy.snapshots.map(snapshot => ({ ...snapshot, portfolios: snapshot.portfolios.map(upgrade) })) });
}

export function createDefaultFinanceData(today = new Date().toISOString().slice(0, 10)): FinanceData {
  return validateFinanceData({
    version: FINANCE_VERSION, currency: 'EUR',
    income: { regularAmount: 0, paymentsPerYear: 12, extraPayments: [], annualRealGrowthPercent: 0 },
    expenses: [], irregularExpenses: [], cash: [], portfolios: [], debts: [], snapshots: [],
    plan: { asOf: today, age: 25, horizonYears: 40, reviewEveryMonths: 3, reserveMonths: 3, policyNotes: '', lockAfterMinutes: 10, setupCompleted: false, allocations: [] },
    fire: { contributionMode: 'suggested', monthlyContribution: 0, annualRealReturnPercent: 0, retirementMonthlySpending: 0, withdrawalRatePercent: 4, costs: [] },
  });
}

export function parseMoney(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) fail('amount', 'use digits and at most two decimals, with no grouping');
  const [whole, fraction = ''] = trimmed.replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  money(result, 'amount');
  return result;
}

export function formatMoney(amount: number, currency = 'EUR', fractionDigits: 0 | 2 = 2): string {
  if (amount !== 0 && Math.abs(amount) < 100) fractionDigits = 2;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount / 100).replace(/\s/g, '');
}

export function formatNumber(value: number, fractionDigits?: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: fractionDigits ?? 0, maximumFractionDigits: fractionDigits ?? 2 }).format(value);
}

export function formatPercent(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.005) return value < 0 ? '>-0,01%' : '<0,01%';
  return `${formatNumber(value)}%`;
}

export function formatDate(value: string): string {
  // boffin: keep a saved calendar day unchanged in every local time zone.
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDate();
  const suffix = day >= 11 && day <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th');
  return `${day}${suffix} ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)}`;
}
