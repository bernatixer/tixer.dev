import assert from 'node:assert/strict'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FINANCE_CONTROLS_URL || 'http://localhost:3000'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'controls regression requires local Vite')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) })
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const { default: React } = await import('/node_modules/.vite/deps/react.js');
const { useState } = React;
const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
const { createRoot } = ReactDOM;
const { FinanceSelect, FinanceDateInput } = await import('/src/finance/FinanceControls.tsx');
const { StyledSelect } = await import('/src/components/todo/StyledSelect.tsx');
await import('/src/styles/shared.css');
await import('/src/finance/finance.css');
const h = React.createElement;
const options = [{id:'eur',label:'Euro'}, {id:'gbp',label:'Disabled sterling',disabled:true}, {id:'usd',label:'Dollar'}];
function App() {
  const [currency, setCurrency] = useState('eur');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('2026-03-01');
  const [dependency, setDependency] = useState('eur');
  const field = (name,id,control) => h('div',{className:'finance-field'},h('label',{htmlFor:id},name),control);
  return h('main',{className:'finance-app',style:{maxWidth:600}},
    h('form',{id:'controls-form',onSubmit:e=>e.preventDefault()},
      field('Currency','currency',h(FinanceSelect,{id:'currency',options,value:currency,onChange:setCurrency})),
      h('output',{id:'currency-value'},currency),
      field('Required target','target',h(FinanceSelect,{id:'target',required:true,options:[{id:'',label:'Choose target',disabled:true},...options],value:target,onChange:setTarget})),
      field('Empty','empty',h(FinanceSelect,{id:'empty',options:[],value:'',onChange:setCurrency})),
      field('Disabled choices','disabled-choices',h(FinanceSelect,{id:'disabled-choices',options:options.map(o=>({...o,disabled:true})),value:'',onChange:setCurrency})),
      field('Disabled control','disabled-control',h(FinanceSelect,{id:'disabled-control',disabled:true,options,value:'eur',onChange:setCurrency})),
      field('Starts on','starts',h(FinanceDateInput,{id:'starts',value:date,onChange:setDate,required:true,min:'2026-03-01',max:'2026-03-31'})),
      field('Todo dependency','dependency',h(StyledSelect,{id:'dependency',options,value:dependency,onChange:setDependency,searchable:true,searchPlaceholder:'Search tasks…'})),
      h('button',{type:'submit'},'Save')),
    h('button',{onClick:()=>document.querySelector('dialog').showModal()},'Open drawer'),
    h('dialog',null,
      field('Drawer currency','drawer-currency',h(FinanceSelect,{id:'drawer-currency',options,value:currency,onChange:setCurrency})),
      field('Drawer date','drawer-date',h(FinanceDateInput,{id:'drawer-date',value:date,onChange:setDate}))))
}
createRoot(document.getElementById('root')).render(h(App));
</script></body></html>`
try {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(`${base}/tests/controls-regression.html`, route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.goto(`${base}/tests/controls-regression.html`)
  const currency = page.getByRole('combobox', { name: 'Currency', exact: true })
  await currency.waitFor()
  await currency.focus()
  await currency.press('ArrowDown')
  await currency.press('ArrowDown')
  assert.equal(await page.locator('#currency-value').innerText(), 'eur', 'navigation must not commit a value')
  await currency.press('Enter')
  assert.equal(await page.locator('#currency-value').innerText(), 'usd', 'navigation must skip disabled options')
  assert(await currency.evaluate(el => el === document.activeElement), 'selection restores trigger focus')
  assert.equal(await page.getByRole('listbox').count(), 0, 'closed options must be unmounted')
  for (const name of ['Empty', 'Disabled choices']) {
    const control = page.getByRole('combobox', { name, exact: true })
    await control.press('ArrowDown'); await control.press('ArrowUp'); await control.press('Enter'); await control.press('Escape')
  }
  assert(await page.getByRole('combobox', { name: 'Disabled control', exact: true }).isDisabled())
  assert.equal(await page.locator('#controls-form').evaluate(form => form.reportValidity()), false)
  await page.getByRole('alert').waitFor()
  assert(await page.getByRole('combobox', { name: 'Required target', exact: true }).evaluate(el => el === document.activeElement))
  await page.getByRole('combobox', { name: 'Required target', exact: true }).press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#controls-form').evaluate(form => form.checkValidity()), true)
  const date = page.getByLabel('Starts on', { exact: true })
  await page.locator('.finance-date').first().getByRole('button', { name: 'Choose date', exact: true }).click()
  const calendar = page.getByRole('dialog', { name: 'Choose date', exact: true })
  await calendar.getByText('Mar 2026', { exact: true }).waitFor()
  assert(await calendar.getByRole('button', { name: 'Previous month', exact: true }).isDisabled())
  assert(await calendar.getByRole('button', { name: 'Next month', exact: true }).isDisabled())
  assert(await calendar.getByRole('button', { name: 'Sunday, March 1, 2026', exact: true }).evaluate(el => el.getAttribute('aria-pressed') === 'true'))
  await calendar.getByRole('button', { name: 'Tuesday, March 10, 2026', exact: true }).click()
  assert.equal(await date.inputValue(), '2026-03-10')
  await date.fill('2026-02-28')
  assert(await date.evaluate(el => el.validity.rangeUnderflow), 'typed dates preserve min validation')
  await date.fill('2026-04-01')
  assert(await date.evaluate(el => el.validity.rangeOverflow), 'typed dates preserve max validation')
  await date.fill('2026-03-10')
  await page.locator('.finance-date').first().getByRole('button', { name: 'Choose date', exact: true }).click()
  await page.getByRole('button', { name: 'Clear date', exact: true }).click()
  assert(await date.evaluate(el => el.validity.valueMissing), 'clearing a required date remains invalid')
  await date.fill('2026-03-10')
  const todo = page.getByRole('combobox', { name: 'Todo dependency', exact: true })
  await todo.click()
  const search = page.getByRole('combobox', { name: 'Search tasks…', exact: true })
  await search.fill('no match')
  await search.press('ArrowDown'); await search.press('Enter')
  await page.getByRole('status').filter({ hasText: 'No matches' }).waitFor()
  await search.fill('Dollar'); await search.press('ArrowDown'); await search.press('Enter')
  assert.equal(await todo.innerText(), 'Dollar')
  await todo.click(); await search.press('Escape')
  assert(await todo.evaluate(el => el === document.activeElement))
  assert.equal(await page.getByRole('combobox', { name: 'Search tasks…', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Open drawer', exact: true }).click()
  const drawer = page.locator('dialog')
  const drawerSelect = page.getByRole('combobox', { name: 'Drawer currency', exact: true })
  await drawerSelect.click(); await page.keyboard.press('Escape')
  assert(await drawer.evaluate(el => el.open), 'select Escape must not dismiss its native dialog')
  await drawer.getByRole('button', { name: 'Choose date', exact: true }).click()
  assert(await drawer.locator('.finance-date__popover').isVisible(), 'calendar stays inside native dialog')
  await page.keyboard.press('Escape')
  assert(await drawer.evaluate(el => el.open), 'calendar Escape must not dismiss its native dialog')
  assert.equal(await drawer.locator('.finance-date__popover').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: reused select and calendar support keyboard, disabled/empty options, required fields, local dates, min/max, search, focus restoration and native dialogs.')
} finally { await browser.close() }
