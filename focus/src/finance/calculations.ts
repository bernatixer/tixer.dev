import { validateFinanceData, type Debt, type FinanceData, type PortfolioObservation } from './model.ts';

export interface Overview {
  incomeAnnual: number; incomeMonthly: number; expensesAnnual: number; expensesMonthly: number;
  requiredDebtMonthly: number; additionalDebtMonthly: number; surplusMonthly: number; deficitMonthly: number;
  reserveHeld: number; cashTotal: number; earmarkedCash: number; unearmarkedCash: number;
  portfolioTotal: number; debtTotal: number; netWorth: number;
  missingObservations: string[]; warnings: string[];
}
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const rounded = (value: number) => Math.round(value);

export function calculateInvestment(row: PortfolioObservation): { netAdded: number | null; gain: number | null; gainPercent: number | null } {
  if (row.totalContributions === null) return { netAdded: null, gain: null, gainPercent: null };
  const netAdded = row.totalContributions - (row.totalWithdrawals ?? 0);
  // boffin: Recorded contributions remain known even when no valuation was entered.
  if (row.balance === null) return { netAdded, gain: null, gainPercent: null };
  const gain = row.balance - netAdded;
  return { netAdded, gain, gainPercent: row.totalContributions > 0 ? gain / row.totalContributions * 100 : null };
}

export function annualIncome(input: FinanceData): number {
  const data = validateFinanceData(input);
  return data.income.regularAmount * data.income.paymentsPerYear + sum(data.income.extraPayments.map(payment => payment.amount));
}

function monthlyRate(debt: Debt): number {
  return debt.rateConvention === 'nominal' ? debt.annualRatePercent / 1200 : (1 + debt.annualRatePercent / 100) ** (1 / 12) - 1;
}
function requiredPayment(debt: Debt, balance = debt.balance): number {
  return Math.min(balance + rounded(balance * monthlyRate(debt)), debt.monthlyPayment);
}

export function monthlyBreakdown(input: FinanceData) {
  const data = validateFinanceData(input);
  const monthly = (rows: { label: string; annual: number }[]) => {
    let annual = 0;
    return rows.filter(row => row.annual !== 0).map(row => {
      const previous = rounded(annual / 12);
      annual += row.annual;
      // boffin: Carry fractional cents so the detail rows add up to the monthly total.
      return { label: row.label, amount: rounded(annual / 12) - previous };
    });
  };
  return {
    income: monthly([
      { label: 'Salary', annual: data.income.regularAmount * data.income.paymentsPerYear },
      ...data.income.extraPayments.map(row => ({ label: row.label, annual: row.amount })),
    ]),
    costs: monthly([
      ...data.expenses.map(row => ({ label: row.label, annual: row.amount * (row.frequency === 'monthly' ? 12 : 1) })),
      ...data.irregularExpenses.map(row => ({ label: row.label, annual: row.annualAmount })),
      ...data.debts.map(row => ({ label: row.includedInBaseline ? `${row.label} · payment adjustment` : row.label,
        annual: (requiredPayment(row) - (row.includedInBaseline ? row.monthlyPayment : 0)) * 12 })),
    ]),
  };
}

export function calculateOverview(input: FinanceData): Overview {
  const data = validateFinanceData(input);
  const incomeAnnual = annualIncome(data);
  const includedCommitment = sum(data.debts.filter(debt => debt.includedInBaseline).map(debt => debt.monthlyPayment));
  const includedActual = sum(data.debts.filter(debt => debt.includedInBaseline).map(debt => requiredPayment(debt)));
  const expensesAnnual = sum(data.expenses.map(expense => expense.amount * (expense.frequency === 'monthly' ? 12 : 1)))
    + sum(data.irregularExpenses.map(expense => expense.annualAmount)) + (includedActual - includedCommitment) * 12;
  const incomeMonthly = rounded(incomeAnnual / 12);
  const expensesMonthly = rounded(expensesAnnual / 12);
  const requiredDebtMonthly = sum(data.debts.map(debt => requiredPayment(debt)));
  const additionalDebtMonthly = sum(data.debts.filter(debt => !debt.includedInBaseline).map(debt => requiredPayment(debt)));
  // boffin: Retired scenarios and allocation rules stay stored but cannot change the current budget.
  const surplusMonthly = incomeMonthly - expensesMonthly - additionalDebtMonthly;
  const reserveHeld = sum(data.cash.flatMap(account => account.earmarks.filter(mark => mark.purpose === 'emergency').map(mark => mark.amount)));
  const cashTotal = sum(data.cash.map(account => account.balance ?? 0));
  const earmarkedCash = sum(data.cash.flatMap(account => account.earmarks.map(mark => mark.amount)));
  const portfolioTotal = sum(data.portfolios.map(portfolio => portfolio.balance ?? 0));
  const debtTotal = sum(data.debts.map(debt => debt.balance));
  const accounts = [...data.cash, ...data.portfolios, ...data.debts];
  const missingObservations = accounts.filter(account => account.balance === null).map(account => account.label);
  const warnings = data.debts.filter(debt => debt.balance > 0 && debt.monthlyPayment <= rounded(debt.balance * monthlyRate(debt)))
    .map(debt => `${debt.label}: the monthly payment does not reduce the balance at the entered interest rate.`);
  return { incomeAnnual, incomeMonthly, expensesAnnual, expensesMonthly, requiredDebtMonthly, additionalDebtMonthly,
    surplusMonthly, deficitMonthly: Math.max(0, -surplusMonthly), reserveHeld, cashTotal, earmarkedCash,
    unearmarkedCash: cashTotal - earmarkedCash, portfolioTotal, debtTotal, netWorth: cashTotal + portfolioTotal - debtTotal,
    missingObservations, warnings };
}
