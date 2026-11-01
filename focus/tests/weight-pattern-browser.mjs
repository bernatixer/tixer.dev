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
let days = Array.from({ length: 14 }, (_, i) => ({ date: day(i - 15), kcal: i % 2 ? 2000 : i === 0 ? 3000 : 3300, mealCount: 3 }))
let entries = Array.from({ length: 15 }, (_, i) => ({ date: day(i - 15), weightKg: i % 2 ? 80.5 : 80 }))
const human = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
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
    if (path.startsWith('/api/weight/days/')) {
      const date = path.split('/').at(-1), food = days.find(day => day.date === date)
      return json({ date, meals: food ? [{ id: date, date, description: 'Synthetic food', kcal: food.kcal, createdAt: `${date}T12:00:00Z` }] : [] })
    }
    if (path === '/api/telegram') return json({ linked: false })
    return route.abort()
  })
  await page.goto(`${base}/weight`)
  const panel = page.locator('.weight-chart')
  await panel.waitFor({ timeout: 5000 })
  const calories = panel.getByRole('button', { name: 'Daily calories', exact: true })
  assert.equal(await calories.getAttribute('aria-pressed'), 'true', 'food and weight share the timeline on first load')
  assert.equal(await panel.locator('.weight-chart__calories').count(), 14)
  assert.equal(await panel.locator('.weight-chart__calories--high').count(), 7, 'the 3,000 boundary is included')
  const bar = date => panel.getByRole('button', { name: `Food for ${human(date)}: ${days.find(day => day.date === date).kcal} kcal`, exact: true })
  const tooltip = panel.locator('.weight-chart__tooltip')
  await bar(day(-15)).focus()
  assert.equal(await tooltip.getByText('Next morning', { exact: false }).locator('strong').innerText(), '80.50 kg')
  assert.equal(await tooltip.getByText('Overnight change', { exact: false }).locator('strong').innerText(), '+0.50 kg')
  const description = await bar(day(-15)).evaluate(element => document.getElementById(element.getAttribute('aria-describedby'))?.textContent ?? '')
  assert(description.includes('Overnight change +0.50 kg'), 'keyboard focus exposes the new result to screen readers')
  await bar(day(-14)).focus()
  assert.equal(await tooltip.getByText('Overnight change', { exact: false }).locator('strong').innerText(), '−0.50 kg')
  await calories.click()
  assert.equal(await panel.locator('.weight-chart__calories').count(), 0)
  await calories.click()
  await bar(day(-15)).focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('heading', { name: human(day(-15)), exact: true }).waitFor()
  await drawer.getByRole('button', { name: 'Close day', exact: true }).click()
  const output = process.env.WEIGHT_SCREENSHOT_DIR
  if (output) {
    await mkdir(output, { recursive: true })
    await panel.screenshot({ path: `${output}/timeline-desktop.png` })
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${width}px`)
    assert(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `panel overflow at ${width}px`)
    await bar(day(-15)).tap()
    await drawer.getByRole('heading', { name: human(day(-15)), exact: true }).waitFor()
    await drawer.getByRole('button', { name: 'Close day', exact: true }).click()
    if (output) await panel.screenshot({ path: `${output}/timeline-${width}.png` })
  }
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'softLight')
  if (output) await panel.screenshot({ path: `${output}/timeline-light.png` })
  entries = entries.filter(entry => entry.date !== day(-14))
  await page.reload()
  await panel.waitFor()
  await bar(day(-15)).focus()
  assert.equal(await tooltip.getByText('Overnight change', { exact: false }).locator('strong').innerText(), '—', 'missing next morning cannot borrow a later weigh-in')
  entries = [...entries.map(entry => entry.date === day(-12) ? { ...entry, weightKg: 80 } : entry), { date: day(0), weightKg: 80 }, { date: day(1), weightKg: 90 }]
  days = [...days, { date: day(0), kcal: 3200, mealCount: 3 }]
  await page.reload()
  await panel.waitFor()
  await bar(day(-13)).focus()
  assert.equal(await tooltip.getByText('Overnight change', { exact: false }).locator('strong').innerText(), '±0.00 kg')
  await bar(day(0)).focus()
  assert.equal(await tooltip.getByText('Next morning', { exact: false }).locator('strong').innerText(), 'Pending')
  assert.equal(await tooltip.getByText('Overnight change', { exact: false }).locator('strong').innerText(), '—', 'future records cannot create an observed change')
  days = []
  await page.reload()
  await panel.waitFor()
  assert.equal(await panel.locator('.weight-chart__calories').count(), 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(mutations, [], 'pattern inspection cannot write personal records')
  console.log('PASS: timeline defaults, high-calorie highlights, exact next-morning changes, keyboard/touch food editing, missing readings/food, desktop/phone layout and read-only behavior')
} finally { await browser.close() }
