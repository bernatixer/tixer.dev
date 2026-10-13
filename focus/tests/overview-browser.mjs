import assert from 'node:assert/strict'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FINANCE_OVERVIEW_URL || 'http://localhost:3000'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'overview regression requires local Vite')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) })
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const { default: React } = await import('/node_modules/.vite/deps/react.js');
const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
const { Overview } = await import('/src/finance/Overview.tsx');
const { ThemeProvider } = await import('/src/hooks/useTheme.tsx');
const { createDefaultFinanceData } = await import('/src/finance/model.ts');
await import('/src/styles/shared.css');
await import('/src/finance/finance.css');
const root = ReactDOM.createRoot(document.getElementById('root'));
window.renderOverview = scenario => {
  const data = createDefaultFinanceData('2026-10-12');
  data.income.regularAmount = 500000;
  data.income.extraPayments = [{ id: 'bonus', label: 'Bonus', amount: 60000 }];
  data.expenses = [{ id: 'rent', label: 'Essentials', amount: 200000, frequency: 'monthly', category: 'essential' }];
  data.plan.reserveMonths = 6;
  data.plan.allocations = [
    { id: 'reserve', kind: 'reserve', amount: 50000, targetId: null },
    { id: 'retain', kind: 'retain', amount: 25000, targetId: null },
    { id: 'invest', kind: 'invest', amount: 125000, targetId: null },
  ];
  data.cash = [{ id: 'cash', label: 'Bank', balance: 1400000, observedOn: '2026-10-12', earmarks: [
    { id: 'cushion', label: 'Cushion', amount: 945000, purpose: 'emergency', plannedCostId: null },
    { id: 'purchase', label: 'Purchase', amount: 200000, purpose: 'planned', plannedCostId: 'cost' },
  ] }];
  data.fire.costs = [{ id: 'cost', label: 'Purchase', amount: 200000, startsOn: '2027-01-12', endsOn: null, frequency: 'once', earmarkId: 'purchase' }];
  data.portfolios = [{ id: 'fund', label: 'Synthetic portfolio', balance: 600000, observedOn: '2026-10-11', equityPercent: null, bondPercent: null, totalContributions: 500000, totalWithdrawals: null, cashFlowsConfirmed: false }];
  data.debts = [{ id: 'loan', label: 'Loan', balance: 120000, observedOn: '2026-10-12', annualRatePercent: 0, rateConvention: 'nominal', variableAssumption: false, monthlyPayment: 10000, includedInBaseline: false }];
  if (scenario === 'investment-history') {
    data.portfolios[0].totalWithdrawals = 50000; data.portfolios[0].cashFlowsConfirmed = true;
    const observation = { id: 'fund', balance: 300000, observedOn: '2026-01-03', totalContributions: 280000, totalWithdrawals: 0, cashFlowsConfirmed: true };
    data.snapshots = [
      { id: 'first', date: '2026-01-03', incomeAnnual: null, cash: [], debts: [], portfolios: [observation] },
      { id: 'gap', date: '2026-04-01', incomeAnnual: null, cash: [], debts: [], portfolios: [{ ...observation, balance: 400000, observedOn: '2026-04-01', totalContributions: null, cashFlowsConfirmed: false }] },
      { id: 'later', date: '2026-07-01', incomeAnnual: null, cash: [], debts: [], portfolios: [{ ...observation, balance: 500000, observedOn: '2026-07-01', totalContributions: 450000, totalWithdrawals: 20000 }] },
    ];
    data.portfolios.push({ ...data.portfolios[0], id: 'second', label: 'Second portfolio', balance: 90000, totalContributions: 100000, totalWithdrawals: 0 });
  }
  if (scenario === 'fourteen-payments') { data.income.paymentsPerYear = 14; data.income.extraPayments = []; }
  if (scenario === 'reordered') data.portfolios[0].balance = 2000000;
  if (scenario === 'early-deposit') data.snapshots = [{ id: 'deposit', date: '2021-12-10', incomeAnnual: null, cash: [], debts: [], portfolios: [
    { id: 'fund', balance: null, observedOn: null, totalContributions: 100000, totalWithdrawals: 0, cashFlowsConfirmed: false },
  ] }];
  if (scenario === 'cash-only') data.portfolios = [];
  if (scenario === 'missing-contributions') data.portfolios[0].totalContributions = null;
  if (scenario === 'empty') { data.cash = []; data.portfolios = []; data.fire.costs = []; }
  if (scenario === 'zero') { data.cash[0].balance = 0; data.cash[0].earmarks = []; data.fire.costs = []; data.portfolios[0].balance = 0; }
  if (scenario === 'included-loan') data.debts[0].includedInBaseline = true;
  if (scenario === 'retired-settings') {
    data.fire.monthlyContribution = 9999999;
    data.fire.costs[0].startsOn = '2026-10-12';
    data.fire.costs[0].amount = 9999999;
  }
  if (scenario === 'deficit') { data.income.regularAmount = 0; data.income.extraPayments = []; }
  if (scenario === 'unknown') {
    data.portfolios = [{ id: 'unknown', label: 'Unknown fund', balance: null, observedOn: null, equityPercent: null, bondPercent: null, totalContributions: null, totalWithdrawals: null, cashFlowsConfirmed: false }];
    data.cash[0].observedOn = '2025-01-01';
    data.snapshots = [{ id: 'snapshot', date: '2026-10-12', incomeAnnual: null, cash: [], portfolios: [{ id: 'unknown', balance: null, observedOn: null, totalContributions: null, totalWithdrawals: null, cashFlowsConfirmed: false }], debts: [] }];
  }
  if (scenario === 'loan-warning') { data.debts[0].annualRatePercent = 100; data.debts[0].monthlyPayment = 100; data.debts[0].variableAssumption = true; }
  root.render(React.createElement(ThemeProvider, null, React.createElement('main', { className: 'finance-app', 'data-scenario': scenario }, React.createElement(Overview, { data, onEditAccounts(id) { window.editedInvestment = id; } }))));
};
window.renderOverview('suggested');
</script></body></html>`
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, hasTouch: true })
  const errors = []
  const dataRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/\/api\/|posthog|5556|5557/.test(request.url())) dataRequests.push(request.url()) })
  await page.route(`${base}/tests/overview-regression.html`, route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.goto(`${base}/tests/overview-regression.html`)
  const render = async scenario => {
    await page.evaluate(scenario => window.renderOverview(scenario), scenario)
    await page.locator(`[data-scenario="${scenario}"]`).waitFor()
  }
  const monthly = page.locator('.finance-monthly__table')
  await monthly.waitFor()
  assert.equal(await page.getByRole('button', { name: 'History', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Future', exact: true }).count(), 0)
  assert.equal(await page.getByLabel('Annual return for Synthetic portfolio', { exact: true }).inputValue(), '20')
  assert.equal(await page.locator('.finance-growth > .finance-card-heading').getByRole('combobox', { name: 'Projection years' }).count(), 1)
  const projection = page.getByRole('slider', { name: 'Projected assets', exact: true })
  await projection.focus(); await projection.press('Home')
  assert.match(await projection.getAttribute('aria-valuetext'), /Today.*20\.000€.*Estimated gains 0€/)
  await page.getByLabel('Annual return for Synthetic portfolio', { exact: true }).fill('-10')
  assert.equal(await page.locator('.finance-simulator__results dd.finance-danger').evaluate(el => getComputedStyle(el).color), await monthly.locator('.finance-monthly__cost td').evaluate(el => getComputedStyle(el).color), 'projected losses must remain red')
  await page.getByLabel('Annual return for Synthetic portfolio', { exact: true }).fill('10')
  await page.getByLabel('Monthly to Synthetic portfolio', { exact: true }).fill('500.123')
  assert.equal(await projection.count(), 0, 'invalid raw input must hide the stale projection')
  await page.getByLabel('Monthly to Synthetic portfolio', { exact: true }).fill('500')
  await page.getByRole('button', { name: 'Use remaining for Synthetic portfolio', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Monthly to Synthetic portfolio"]').value === '2950')
  assert.equal(await page.getByLabel('Monthly to Synthetic portfolio', { exact: true }).inputValue(), '2950')
  await page.getByText('Move money now', { exact: true }).click()
  await page.getByLabel('Transfer amount', { exact: true }).fill('3000')
  await page.getByRole('button', { name: 'Preview transfer', exact: true }).click()
  assert.match(await page.getByRole('alert').innerText(), /not enough available money/)
  await page.getByLabel('Transfer amount', { exact: true }).fill('2000')
  await page.getByRole('button', { name: 'Preview transfer', exact: true }).click()
  assert.match(await page.locator('.finance-simulator__move').innerText(), /Bank → Synthetic portfolio.*2\.000€/)
  await projection.focus(); await projection.press('Home')
  assert.match(await projection.getAttribute('aria-valuetext'), /Today.*20\.000€/)
  assert.equal(await page.locator('.finance-simulator__move').count(), 1)
  await projection.hover()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('tooltip').count(), 0)
  await page.getByRole('button', { name: 'Reset scenario', exact: true }).click()
  assert.equal(await page.getByLabel('Annual return for Synthetic portfolio', { exact: true }).inputValue(), '20')
  assert.equal(await page.locator('.finance-simulator__move').count(), 0)
  assert.match(await monthly.locator('tr').first().innerText(), /Income[\s\S]*5\.050€/)
  assert.match(await monthly.locator('tr').last().innerText(), /Left[\s\S]*2\.950€/)
  assert.deepEqual(await monthly.getByRole('rowheader').allTextContents(), ['Income', 'Costs', 'Left'])
  assert.match(await monthly.getByRole('row').filter({ hasText: 'Costs' }).innerText(), /2\.100€/, 'Costs must include loan payments not already in expenses')
  const costsToggle = monthly.getByRole('button', { name: 'Costs', exact: true });
  await costsToggle.click();
  assert.equal(await costsToggle.getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('#finance-costs-breakdown').innerText(), /Essentials[\s\S]*2\.000€[\s\S]*Loan[\s\S]*100€/);
  await costsToggle.press('Enter');
  assert.equal(await page.locator('#finance-costs-breakdown').isVisible(), false);
  await monthly.getByRole('button', { name: 'Income', exact: true }).click();
  assert.match(await page.locator('#finance-income-breakdown').innerText(), /Salary[\s\S]*5\.000€[\s\S]*Bonus[\s\S]*50€/);
  await monthly.getByRole('button', { name: 'Income', exact: true }).click();
  assert.equal(await page.getByText('Confirm totals', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Update balances', exact: true }).count(), 0)
  assert.equal(await page.locator('.finance-checkin-card').count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Manage accounts', exact: true }).count(), 0)
  assert.match(await page.getByRole('table', { name: 'Accounts' }).innerText(), /\+1\.000€\s+20%/)
  const cash = page.locator('.finance-cash-breakdown')
  assert.match(await cash.innerText(), /Emergency savings[\s\S]*9\.450€[\s\S]*Purchase · Bank[\s\S]*2\.000€[\s\S]*Available cash[\s\S]*2\.550€/)
  assert.equal(await cash.getByText('Other money set aside', { exact: true }).count(), 0)
  assert.match(await cash.locator('.finance-cash-breakdown__bar').innerText(), /67,5%[\s\S]*14,29%[\s\S]*18,21%/)
  const assets = page.getByRole('table', { name: 'Accounts' })
  assert.match(await assets.getByRole('row').filter({ hasText: 'Bank' }).innerText(), /14\.000€[\s\S]*70%/)
  assert.match(await assets.getByRole('row').filter({ hasText: 'Synthetic portfolio' }).innerText(), /6\.000€[\s\S]*30%/)
  assert.equal(await assets.getByText('Loan', { exact: true }).count(), 0, 'loans must not be slices of owned assets')
  assert.equal(await page.locator('.finance-assets__donut').count(), 1)
  assert.equal(await page.locator('.finance-stats').count(), 0)
  assert.deepEqual(await assets.getByRole('columnheader').allTextContents(), ['Account', 'Balance', 'Share', 'Money added', 'Gain / loss'])
  assert.equal(await page.locator('.finance-growth table').count(), 0, 'growth must be a separate chart panel without duplicate accounts')
  assert.deepEqual(await assets.getByRole('row').filter({ hasText: 'Bank' }).getByRole('cell').allTextContents(), ['14.000€', '70%', '—', '—'])
  assert.match(await page.locator('.finance-assets__totals').innerText(), /Loans left to repay[\s\S]*1\.200€/)
  assert.equal(await page.locator('.finance-assets .finance-tooltip-trigger').count(), 0)
  assert.equal(await page.locator('.finance-assets').getByText('Net worth', { exact: true }).count(), 0)
  assert.equal(await assets.locator('.finance-assets__share').first().evaluate(el => getComputedStyle(el).color === getComputedStyle(el.closest('td')).color), true, 'shares must use normal table text color')
  assert.equal(await monthly.locator('.finance-tooltip-trigger').count(), 0, '12-payment salary must not show the formula tooltip')
  assert.equal(await page.getByText('This is an estimate, not your bank balance.', { exact: true }).count(), 0)
  const donut = page.locator('.finance-assets__donut')
  await donut.scrollIntoViewIfNeeded()
  const ring = await donut.boundingBox()
  const tableBounds = await assets.boundingBox()
  assert(ring.height >= 280 && ring.height <= Math.max(280, tableBounds.height), 'donut must fit the table height with a readable minimum')
  assert(Math.abs(ring.width - ring.height) < 1, 'donut must stay circular')
  await page.mouse.move(ring.x + ring.width * 103 / 120, ring.y + ring.height / 2)
  assert.match(await donut.locator('div').innerText(), /Bank[\s\S]*14\.000€[\s\S]*70%/)
  assert.match(await assets.locator('.finance-assets__row--active').innerText(), /Bank/)
  await page.mouse.move(ring.x + ring.width * 25 / 120, ring.y + ring.height * 35 / 120)
  assert.match(await donut.locator('div').innerText(), /Synthetic portfolio[\s\S]*6\.000€[\s\S]*30%/)
  assert.match(await assets.locator('.finance-assets__row--active').innerText(), /Synthetic portfolio/)
  await page.mouse.move(0, 0)
  assert.equal(await assets.locator('.finance-assets__row--active').count(), 0)
  await page.mouse.click(ring.x + ring.width * 103 / 120, ring.y + ring.height / 2)
  assert.equal(await page.getByRole('img', { name: 'Bank: 14.000€, 70%', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle), 'none')
  await page.getByRole('img', { name: 'Bank: 14.000€, 70%', exact: true }).focus()
  assert.match(await donut.locator('div').innerText(), /Bank[\s\S]*70%/)
  assert.equal(await page.getByRole('img', { name: 'Bank: 14.000€, 70%', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle), 'none')
  const savingsSegment = page.getByRole('img', { name: 'Emergency savings: 9.450€, 67,5%', exact: true })
  await savingsSegment.hover()
  assert.match(await page.getByRole('tooltip').innerText(), /Emergency savings · 9\.450€ · 67,5%/)
  await page.mouse.move(0, 0)
  await page.getByRole('img', { name: 'Available cash: 2.550€, 18,21%', exact: true }).focus()
  assert.match(await page.getByRole('tooltip').innerText(), /Available cash · 2\.550€ · 18,21%/)
  const cashHint = await page.getByRole('tooltip').boundingBox()
  const heading = await page.locator('.finance-overview-columns .finance-eyebrow').first().boundingBox()
  assert(cashHint.x >= heading.x + heading.width || cashHint.x + cashHint.width <= heading.x || cashHint.y >= heading.y + heading.height || cashHint.y + cashHint.height <= heading.y, 'cash tooltip covers its heading')
  await page.getByRole('img', { name: 'Available cash: 2.550€, 18,21%', exact: true }).blur()
  await savingsSegment.hover()
  const savingsTip = page.getByRole('tooltip')
  assert.match(await savingsTip.innerText(), /Emergency savings/)
  const tipBounds = await savingsTip.boundingBox()
  assert(tipBounds.x >= 0 && tipBounds.x + tipBounds.width <= 1280 && tipBounds.y >= 0)
  await page.mouse.move(tipBounds.x + tipBounds.width / 2, tipBounds.y + tipBounds.height / 2)
  await page.waitForTimeout(250)
  assert.equal(await savingsTip.isVisible(), true, 'tooltip must stay open while reading its popup with the pointer')
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('tooltip').count(), 0)
  await render('fourteen-payments')
  assert.equal(await monthly.getByRole('button', { name: 'Income', exact: true }).count(), 0);
  const incomeHint = monthly.locator('.finance-tooltip-trigger')
  await incomeHint.focus()
  await page.getByRole('tooltip').waitFor()
  await render('empty')
  await page.getByText('Add your first account to see the breakdown.', { exact: true }).waitFor()
  await render('zero')
  assert.equal(await cash.locator('dl > div').count(), 2, 'empty savings goals must not produce a phantom Other category')
  assert.equal(await assets.getByText('—', { exact: true }).count() >= 2, true, 'zero totals cannot produce percentage shares')
  assert(!/NaN|Infinity/.test(await page.locator('main').innerText()))
  await render('suggested')
  assert.equal(await page.locator('.finance-distribution, .finance-fire').count(), 0)
  assert.equal(await page.getByText('Income history & forecast', { exact: true }).count(), 0)
  assert.equal(await page.getByText('Suggested investment', { exact: true }).count(), 0)
  assert.equal(await page.getByText(/Estimated payoff/).count(), 0)
  await render('reordered')
  assert.deepEqual(await assets.locator('tbody th > span').allTextContents(), ['Synthetic portfolioInvestment', 'BankCash'])
  assert.match(await page.locator('.finance-assets__donut [role="img"]').first().getAttribute('aria-label'), /^Synthetic portfolio:/)
  assert.equal(await assets.locator('tbody th i').first().evaluate(el => el.style.backgroundColor), 'rgb(183, 154, 230)', 'sorting must preserve an account’s swatch color')

  await render('retired-settings')
  assert.match(await monthly.locator('tr').last().innerText(), /Left[\s\S]*2\.950€/)
  await render('included-loan')
  assert.match(await monthly.getByRole('row').filter({ hasText: 'Costs' }).innerText(), /2\.000€/, 'included loan payments must not be subtracted twice')
  assert.match(await monthly.locator('tr').last().innerText(), /3\.050€/)
  await render('deficit')
  await page.getByRole('rowheader', { name: 'Left', exact: true }).waitFor()
  assert.match(await monthly.locator('tr').last().innerText(), /-2\.100€/)

  await render('unknown')
  await page.getByText(/Balance not entered: Unknown fund/).waitFor()
  assert.equal(await page.getByText(/Balances due for an update/).count(), 0)
  assert.match(await assets.getByRole('row').filter({ hasText: 'Unknown fund' }).innerText(), /Unknown[\s\S]*—/)
  await page.getByText('Shares use known balances only.', { exact: true }).waitFor()
  await page.getByText('Balance history (1)', { exact: true }).click()
  await page.getByRole('cell', { name: '12th October 2026 (incomplete)', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add balance for Unknown fund', exact: true }).click()
  assert.equal(await page.evaluate(() => window.editedInvestment), 'unknown')
  await render('missing-contributions')
  await page.getByRole('button', { name: 'Add contributions for Synthetic portfolio', exact: true }).click()
  assert.equal(await page.evaluate(() => window.editedInvestment), 'fund')
  await render('cash-only')
  assert.deepEqual(await assets.getByRole('columnheader').allTextContents(), ['Account', 'Balance', 'Share'])
  assert.equal(await page.getByRole('combobox', { name: 'Investment history' }).count(), 0)
  await render('loan-warning')
  await page.getByText(/monthly payment does not reduce the balance/).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Review your loan payments.', exact: true }).count(), 0)

  await render('investment-history')
  const investments = page.getByRole('table', { name: 'Accounts' })
  assert.equal(await investments.evaluate(table => table.scrollWidth <= table.parentElement.clientWidth), true, 'all combined columns must fit beside the donut on desktop')
  assert.equal(await page.getByRole('combobox', { name: 'Investment history', exact: true }).count(), 0)
  const chart = page.getByRole('slider', { name: 'Projected assets', exact: true })
  await chart.focus(); await page.keyboard.press('Home')
  assert.match(await chart.getAttribute('aria-valuetext'), /Today.*Estimated gains 0€/)
  await page.keyboard.press('ArrowRight')
  assert(!/Today/.test(await chart.getAttribute('aria-valuetext')))
  await chart.hover({ position: { x: (await chart.boundingBox()).width - 10, y: 80 } })
  await page.getByRole('tooltip').waitFor()
  await page.mouse.move(0, 0)
  assert.equal(await chart.locator('.finance-projection__cursor').count(), 0)
  assert.equal(await page.getByRole('tooltip').count(), 0)
  await chart.click({ position: { x: 20, y: 160 } })
  assert.equal(await chart.evaluate(el => getComputedStyle(el).outlineStyle), 'none')
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('tooltip').count(), 0)
  assert(await page.locator('.finance-simulator__results > div').evaluateAll(rows => rows.every(row => Math.abs(row.querySelector('dt').getBoundingClientRect().left - row.querySelector('dd').getBoundingClientRect().left) < 1)), 'result labels and values must share a left edge')
  assert((await page.locator('.finance-simulator__account').first().boundingBox()).height < 75, 'desktop account controls must stay compact')
  await page.screenshot({ path: '/tmp/finance-simulator-desktop.png', fullPage: true, animations: 'disabled' })
  await render('suggested')
  await page.setViewportSize({ width: 390, height: 844 })
  await monthly.getByRole('button', { name: 'Costs', exact: true }).click()
  await monthly.getByRole('button', { name: 'Income', exact: true }).click()
  assert.equal(await page.locator('#finance-costs-breakdown').isVisible(), true)
  assert.equal(await page.locator('#finance-income-breakdown').isVisible(), true)
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overview must fit a mobile viewport')
  await page.screenshot({ path: '/tmp/finance-accounts-overview-test-mobile.png', fullPage: true, animations: 'disabled' })
  await chart.scrollIntoViewIfNeeded()
  const touchBounds = await chart.boundingBox()
  await page.touchscreen.tap(touchBounds.x + 5, touchBounds.y + 80)
  assert.match(await chart.getAttribute('aria-valuetext'), /Today/)
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'simulator must fit on mobile')
  await page.keyboard.press('Escape')
  await chart.blur()
  await savingsSegment.focus()
  await page.getByRole('tooltip').waitFor()
  const mobileHint = await page.getByRole('tooltip').boundingBox()
  assert(mobileHint.x >= 0 && mobileHint.x + mobileHint.width <= 390, 'Cash tooltip must fit the mobile viewport')
  await page.keyboard.press('Escape')
  assert.deepEqual(errors, [])
  assert.deepEqual(dataRequests, [], 'overview must not send fixture data to APIs or analytics')
  console.log('Overview checks passed: compact simulation, computed defaults, chart inspection/transfers/reset, receipt disclosures, account shares/donut, unknown balances, budget, loan warnings and mobile width.')
} finally {
  await browser.close()
}
