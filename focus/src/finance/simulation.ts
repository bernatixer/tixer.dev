import { calculateInvestment, calculateOverview } from './calculations.ts';
import { MAX_MONEY, validateFinanceData, type FinanceData } from './model.ts';

export interface Transfer { fromId: string; toId: string; amount: number }
export interface Scenario {
  years: number;
  annualReturns: Record<string, number>;
  monthlyAmounts: Record<string, number>;
  transfers: Transfer[];
}
export interface ProjectionPoint { month: number; total: number; baseline: number; added: number; gain: number; retained: number }

export function createScenario(data: FinanceData): Scenario {
  return { years: 10, annualReturns: Object.fromEntries(data.portfolios.map(row => [row.id, Number((calculateInvestment(row).gainPercent ?? 0).toFixed(2))])), monthlyAmounts: {}, transfers: [] };
}

export function projectionRange(points: ProjectionPoint[]) {
  const values = points.flatMap(row => [row.total, row.baseline]);
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * 0.08, max * 0.001, 100);
  return { low: Math.max(0, min - padding), high: max + padding };
}

export function simulate(input: FinanceData, scenario: Scenario) {
  const data = validateFinanceData(input);
  const surplus = calculateOverview(data).surplusMonthly;
  if (surplus < 0) throw new Error('Monthly costs exceed income. Adjust your plan before allocating a monthly surplus.');
  if (!Number.isInteger(scenario.years) || scenario.years < 1 || scenario.years > 50) throw new Error('Choose a horizon from 1 to 50 years.');
  const accounts = [...data.cash, ...data.portfolios].map(row => {
    if (row.balance === null) throw new Error(`${row.label}: add a balance in Accounts to include it in the simulation.`);
    const annualReturn = scenario.annualReturns[row.id] ?? 0;
    const monthly = scenario.monthlyAmounts[row.id] ?? 0;
    if (!Number.isFinite(annualReturn) || annualReturn < -100 || annualReturn > 100) throw new Error(`${row.label}: annual return must be between −100% and 100%.`);
    if (!Number.isSafeInteger(monthly) || monthly < 0 || monthly > MAX_MONEY) throw new Error(`${row.label}: enter a valid monthly amount.`);
    const reserved = 'earmarks' in row ? row.earmarks.reduce((sum, mark) => sum + mark.amount, 0) : 0;
    return { id: row.id, label: row.label, original: row.balance, start: row.balance, end: row.balance, reserved, annualReturn, monthly };
  });
  if (accounts.length === 0) throw new Error('Add an account to start a simulation.');
  const monthlyLeft = surplus - accounts.reduce((sum, row) => sum + row.monthly, 0);
  if (monthlyLeft < 0) throw new Error('Monthly allocations exceed the amount left from your income.');
  for (const transfer of scenario.transfers) {
    const from = accounts.find(row => row.id === transfer.fromId), to = accounts.find(row => row.id === transfer.toId);
    if (!from || !to || from === to) throw new Error('Choose two different existing accounts for the transfer.');
    if (!Number.isSafeInteger(transfer.amount) || transfer.amount <= 0 || transfer.amount > MAX_MONEY) throw new Error('Enter a positive transfer amount.');
    if (transfer.amount > from.start - from.reserved) throw new Error(`${from.label}: not enough available money. Money set aside stays reserved.`);
    from.start -= transfer.amount;
    to.start += transfer.amount;
  }
  // boffin: Transfers only redistribute starting assets; salary enters the projection once each month.
  const initialTotal = accounts.reduce((sum, row) => sum + row.original, 0);
  const balances = accounts.map(row => row.start), baseline = accounts.map(row => row.original);
  const rates = accounts.map(row => (1 + row.annualReturn / 100) ** (1 / 12));
  const points: ProjectionPoint[] = [];
  for (let month = 0; month <= scenario.years * 12; month++) {
    if (month > 0) for (let i = 0; i < accounts.length; i++) {
      balances[i] = balances[i] * rates[i] + accounts[i].monthly;
      baseline[i] *= rates[i];
    }
    const retained = monthlyLeft * month, added = surplus * month;
    const total = Math.round(balances.reduce((sum, value) => sum + value, 0) + retained);
    const baselineTotal = Math.round(baseline.reduce((sum, value) => sum + value, 0) + added);
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(baselineTotal)) throw new Error('This projection is too large. Reduce the return or time horizon.');
    points.push({ month, total, baseline: baselineTotal, added, gain: total - initialTotal - added, retained });
  }
  accounts.forEach((row, index) => { row.end = Math.round(balances[index]); });
  return { accounts, points, monthlyLeft, initialTotal };
}
