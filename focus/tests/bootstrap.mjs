import assert from 'node:assert/strict'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) })
const base = process.env.FINANCE_PREVIEW_URL || 'http://localhost:3001'
try {
  const context = await browser.newContext()
  const requests = []
  context.on('request', request => requests.push(request.url()))
  await context.route('**/ingest/**', route => route.fulfill({ contentType: 'application/json', body: '{}' }))
  await context.route('**/*.clerk.accounts.dev/**', route => route.abort())
  const page = await context.newPage()
  await page.goto(`${base}/finance.html`)
  await page.waitForTimeout(1000)
  assert(!requests.some(url => /ingest|posthog|board-/.test(url)), 'production finance loaded board or analytics')
  console.log('PASS: production finance HTML and bundled assets load without board or analytics requests')
  await page.goto(`${base}/`)
  await page.waitForFunction(() => navigator.serviceWorker?.controller)
  assert(requests.some(url => /^https:\/\/[^/]+\.clerk\.accounts\.dev\//.test(url)), 'production board did not initialize Clerk')
  assert(!requests.some(url => /\/tests\/|\/__test\/token/.test(url)), 'local preview authentication reached the production build')
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 1, 'board PWA failed to register')
  await page.goto(`${base}/finance.html`)
  requests.length = 0
  await page.waitForTimeout(3500)
  assert(!requests.some(url => /ingest|posthog/.test(url)), 'finance emitted analytics under an existing service worker')
  assert(await page.locator('#root').innerText(), 'production finance entry did not mount')
  console.log('PASS: board PWA registers; finance stays on its dedicated entry without analytics under the existing service worker')
} finally {
  await browser.close()
}
