import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.WEIGHT_PREVIEW_URL || 'http://127.0.0.1:3000'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const day = offset => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000 + offset * 864e5).toISOString().slice(0, 10)
}
// Alternating intake and scale changes give hand-checkable group means of +0.50 and -0.50 kg.
let days = Array.from({ length: 14 }, (_, i) => ({ date: day(i - 15), kcal: i % 2 ? 2000 : 3300, mealCount: 3 }))
const entries = Array.from({ length: 15 }, (_, i) => ({ date: day(i - 15), weightKg: i % 2 ? 80.5 : 80 }))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1050 }, hasTouch: true })
  const errors = [], mutations = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('theme', 'cyberDark'))
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/(?:api|__test)\//, route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    if (!['GET', 'OPTIONS'].includes(request.method())) mutations.push(path)
    if (path === '/__test/token') return json({ token: 'synthetic' })
    if (path === '/api/weight') return json({ entries, days, phases: [], goals: [], meals: [], profile: null })
    if (path === '/api/telegram') return json({ linked: false })
    return route.abort()
  })
  await page.goto(`${base}/weight`)
  const panel = page.getByRole('region', { name: 'Calories and weight pattern', exact: true })
  await panel.waitFor({ timeout: 5000 })
  const groups = panel.locator('.weight-pattern__group')
  assert((await groups.nth(0).innerText()).includes('−0.50 kg'))
  assert((await groups.nth(1).innerText()).includes('+0.50 kg'))
  assert.equal(await panel.getByRole('button', { name: /kcal.*kg/ }).count(), 14)
  await panel.getByRole('button', { name: '3 days later', exact: true }).click()
  assert.equal(await panel.getByRole('button', { name: /kcal.*kg/ }).count(), 12)
  await panel.getByRole('button', { name: '7 days later', exact: true }).click()
  assert.equal(await panel.getByRole('button', { name: /kcal.*kg/ }).count(), 8)
  const dot = panel.getByRole('button', { name: /3300 kcal.*kg/ }).first()
  await dot.focus()
  assert((await panel.locator('.weight-pattern__detail').innerText()).includes('3,300 kcal'))
  assert((await panel.locator('.weight-pattern__detail').innerText()).includes('+0.50 kg'))
  await page.keyboard.press('Enter')
  assert.equal(await dot.getAttribute('aria-pressed'), 'true')
  const output = process.env.WEIGHT_SCREENSHOT_DIR
  if (output) {
    await mkdir(output, { recursive: true })
    await panel.screenshot({ path: `${output}/pattern-desktop.png` })
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${width}px`)
    assert(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `panel overflow at ${width}px`)
    await panel.getByRole('button', { name: 'Next morning', exact: true }).click()
    // Identical samples overlap; touch selects the top point, while keyboard focus reaches each one.
    await panel.getByRole('button', { name: /3300 kcal.*kg/ }).last().tap()
    if (output) await panel.screenshot({ path: `${output}/pattern-${width}.png` })
  }
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'softLight')
  const markerContrasts = await panel.locator('.weight-pattern__dot > span').evaluateAll(async markers => {
    await Promise.all(markers.flatMap(marker => marker.parentElement.getAnimations().map(animation => animation.finished)))
    return markers.map(marker => {
      const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number)
      const background = rgb(getComputedStyle(document.body).backgroundColor)
      const style = getComputedStyle(marker), alpha = Number(style.opacity)
      const foreground = rgb(style.backgroundColor).map((channel, index) => channel * alpha + background[index] * (1 - alpha))
      const luminance = channels => channels.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
      const a = luminance(foreground), b = luminance(background)
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
    })
  })
  const minimumContrast = Math.min(...markerContrasts)
  assert(minimumContrast >= 3, `light-theme dots need 3:1 contrast; measured ${minimumContrast.toFixed(2)}:1`)
  if (output) await panel.screenshot({ path: `${output}/pattern-light.png` })
  days = days.map(day => ({ ...day, kcal: 2000 }))
  await page.reload()
  await panel.waitFor()
  assert.equal(await groups.nth(1).locator('strong').innerText(), '—', 'a missing group cannot look like zero change')
  days = []
  await page.reload()
  await panel.getByText('No matched days yet.', { exact: true }).waitFor()
  assert.equal(await panel.getByRole('button', { name: /kcal.*kg/ }).count(), 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(mutations, [], 'pattern inspection cannot write personal records')
  console.log('PASS: group means, exact lag matching, focus/keyboard/click detail, empty groups, missing food, desktop/phone layout and read-only behavior')
} finally { await browser.close() }
