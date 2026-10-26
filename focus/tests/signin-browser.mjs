import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'https://focus.tixer.dev'
const dist = process.env.SIGNIN_TEST_DIST && resolve(process.env.SIGNIN_TEST_DIST)
const output = process.env.SIGNIN_SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true, mode: 0o700 })
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) })
try {
  for (const [name, path] of [['weight', '/weight.html'], ['board', '/']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' })
    const page = await context.newPage(), errors = [], analytics = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/\/ingest(?:\/|\?)|\.i\.posthog\.com\//.test(request.url())) analytics.push(request.url()) })
    if (dist) await page.route(`${origin}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname !== '/' && pathname !== '/weight.html' && !pathname.startsWith('/assets/')) return route.continue()
      const file = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
      assert(file.startsWith(`${dist}/`))
      const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream'
      return route.fulfill({ status: 200, contentType, body: await readFile(file) })
    })
    await page.addInitScript(() => localStorage.setItem('theme', 'softLight'))
    await page.goto(`${origin}${path}`)
    await page.getByRole('heading', { name: 'Sign in to tixer.dev', exact: true }).waitFor({ timeout: 30000 })
    assert.equal(await page.locator('.signin-logo').count(), 1, `${name} must use the existing TIXER sign-in screen`)
    await page.locator('.signin-tagline').getByText('Focus on what matters', { exact: true }).waitFor()
    assert.equal(await page.locator('.clerk-button').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(191, 255, 0)')
    assert.equal(await page.locator('.clerk-button').evaluate(element => getComputedStyle(element).color), 'rgb(10, 10, 10)')
    assert.notEqual(await page.locator('.cl-card').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)')
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'cyberDark')
    await page.evaluate(() => document.fonts.ready)
    assert(await page.evaluate(() => [...document.fonts].some(font => font.family.replace(/["']/g, '') === 'JetBrains Mono' && font.status === 'loaded')), `${name} must load the brand font`)
    if (output) await page.screenshot({ path: `${output}/${name}-desktop.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} sign-in must fit a phone`)
    const card = await page.locator('.signin-card').boundingBox()
    assert(card.x >= 0 && card.x + card.width <= 390, `${name} sign-in card must stay visible on a phone`)
    if (output) await page.screenshot({ path: `${output}/${name}-phone.png`, fullPage: true })
    if (name === 'weight') assert.deepEqual(analytics, [], 'Weight sign-in must stay outside board analytics')
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('PASS: signed-out Weight and board share the TIXER design, dark Clerk controls and phone layout; Weight emits no analytics')
} finally { await browser.close() }
