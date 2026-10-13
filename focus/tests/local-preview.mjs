import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const api = process.env.FINANCE_TEST_API_URL || 'http://localhost:5557'
assert.equal(new URL(api).port, '5557', 'local preview regression requires the isolated API on port 5557')
assert(['localhost', '127.0.0.1'].includes(new URL(api).hostname), 'local preview regression must use a local API')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM })
try {
  const page = await browser.newPage()
  if (api !== 'http://localhost:5556') await page.route('http://localhost:5556/**', route => route.continue({ url: route.request().url().replace('http://localhost:5556', api) }))
  await page.goto('http://localhost:3000/')
  await page.getByRole('navigation', { name: 'Focus apps' }).waitFor({ timeout: 5000 })
  assert((await page.locator('.todo-title').innerText()).includes('/ todo'))
  await page.getByRole('link', { name: 'Finance', exact: true }).click()
  await page.getByRole('button', { name: /^(Unlock finances|Generate recovery key)$/ }).waitFor()
  await page.getByRole('link', { name: 'Todo', exact: true }).click()
  await page.getByRole('button', { name: 'New Task', exact: false }).waitFor()
  const title = `SYNTHETIC_LOCAL_PREVIEW_${Date.now()}`
  await page.getByRole('button', { name: 'New Task', exact: false }).click()
  await page.getByPlaceholder('What needs to be done?', { exact: true }).fill(title)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText(title, { exact: true }).waitFor()
  await page.reload()
  await page.getByText(title, { exact: true }).waitFor()
  const { token } = await (await fetch(`${api}/__test/token`)).json()
  const headers = { authorization: `Bearer ${token}` }
  const tasks = await (await fetch(`${api}/api/tasks`, { headers })).json()
  const created = tasks.find(task => task.title === title)
  assert(created, 'created task did not reach the local authenticated API')
  assert.equal((await fetch(`${api}/api/tasks/${created.id}`, { method: 'DELETE', headers })).status, 204)
  console.log('PASS: root Todo loads, native Todo/Finance switches work, task creation survives reload through the local authenticated API.')
} finally { await browser.close() }
