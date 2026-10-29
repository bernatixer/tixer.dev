import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.WEIGHT_PREVIEW_URL || 'http://localhost:3000'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
const day = offset => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000 + offset * 864e5).toISOString().slice(0, 10)
}
const foodDate = day(-1)
const humanDate = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
let editedWeight = 80
const meals = [{ id: 'breakfast', date: foodDate, description: 'Synthetic breakfast', kcal: 400, proteinG: 20, carbsG: 50, createdAt: `${foodDate}T08:00:00Z` }]
const snapshot = () => ({
  entries: Array.from({ length: 10 }, (_, index) => ({ date: day(index - 9), weightKg: day(index - 9) === foodDate ? editedWeight : 80 })),
  phases: [{ startDate: day(-20), maintenanceKcal: 2400, intakeKcal: 2000, proteinPerKg: 2.2 }],
  goals: [], profile: null, meals: [...meals],
  days: [{ date: foodDate, kcal: meals.reduce((total, meal) => total + meal.kcal, 0), mealCount: meals.length }],
})
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1050 } })
  const errors = [], submissions = [], gates = new Map()
  const gateFor = async text => {
    for (let attempt = 0; attempt < 200 && !gates.has(text); attempt++) await setTimeout(10)
    assert(gates.has(text), `estimate request did not start: ${text}`)
    return gates.get(text)
  }
  let refreshFails = false, holdNextDay = false
  page.on('pageerror', error => errors.push(error.message))
  // Every API call is synthetic; no request reaches a real estimate provider or database.
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/(?:api|__test)\//, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/__test/token') return json({ token: 'synthetic' })
    if (path === '/api/weight' && request.method() === 'GET') return json(refreshFails ? {} : snapshot(), refreshFails ? 500 : 200)
    if (path === `/api/weight/days/${foodDate}`) {
      const body = { date: foodDate, meals: [...meals] }
      if (holdNextDay) {
        holdNextDay = false
        await new Promise(resolve => gates.set('older day refresh', resolve))
        gates.delete('older day refresh')
      }
      return json(body)
    }
    if (path === `/api/weight/entries/${foodDate}` && request.method() === 'PUT') { editedWeight = request.postDataJSON().weightKg; return json({ date: foodDate, weightKg: editedWeight }) }
    if (path === '/api/meals/breakfast' && request.method() === 'PUT') { meals[0].kcal = request.postDataJSON().kcal; return json(meals[0]) }
    if (path === '/api/telegram') return json({ linked: false })
    if (path === '/api/meals' && request.method() === 'POST') {
      const input = request.postDataJSON()
      submissions.push(input)
      const status = await new Promise(resolve => gates.set(input.text, resolve))
      gates.delete(input.text)
      if (status !== 200) return json({}, status)
      const meal = { id: `meal-${submissions.length}`, date: input.date, description: input.text, kcal: 200, proteinG: 10, createdAt: new Date().toISOString() }
      meals.push(meal)
      return json(meal)
    }
    return json({ error: `Unexpected synthetic request: ${request.method()} ${path}` }, 404)
  })
  await page.goto(`${base}/weight`)
  await page.getByText('HISTORY', { exact: true }).click()
  const openDay = () => page.getByRole('button', { name: `Open ${humanDate(foodDate)}`, exact: true }).click()
  await openDay()
  const drawer = page.getByRole('dialog')
  const composer = () => drawer.getByPlaceholder('What did you eat? e.g. 2 eggs, toast and a coffee with milk')
  await composer().fill('First synthetic meal')
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.weight-food__meals .is-pending'))
  assert.equal(await composer().isEnabled(), true, 'composer must stay enabled while an estimate is pending')
  assert.equal(await composer().inputValue(), '', 'submission immediately clears the composer')
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20
    canvas.getContext('2d').fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await drawer.getByLabel('Meal photo', { exact: true }).setInputFiles({ name: 'synthetic-meal.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') })
  await drawer.getByAltText('Meal photo', { exact: true }).waitFor()
  await drawer.getByPlaceholder('Anything to add? e.g. half portion').fill('Second synthetic meal')
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('dialog .weight-food__meals .is-pending').length === 2)
  await gateFor('Second synthetic meal')
  assert.equal(submissions.length, 2, 'both estimates start immediately')
  await page.mouse.click(20, 300)
  await drawer.waitFor({ state: 'hidden', timeout: 2000 })
  await openDay()
  await drawer.locator('.is-pending').first().waitFor()
  assert.equal(await drawer.locator('.is-pending').count(), 2, 'submitted jobs survive drawer remounts')
  assert.equal(await drawer.getByText('Add known calories', { exact: true }).count(), 0)
  assert.equal(await drawer.getByText('Food coverage', { exact: true }).count(), 0)
  assert.equal(await drawer.getByRole('progressbar', { name: 'Protein of target' }).getAttribute('max'), '120', 'old phase protein values cannot override 1.5 g/kg')
  assert.equal(await drawer.getByRole('progressbar', { name: 'Carbs of target' }).getAttribute('max'), '272', 'carb cap uses the calorie target after protein and minimum fat')
  ;(await gateFor('First synthetic meal'))(200)
  ;(await gateFor('Second synthetic meal'))(500)
  await drawer.getByRole('spinbutton', { name: 'kcal for First synthetic meal', exact: true }).waitFor()
  await drawer.getByRole('button', { name: 'Retry Second synthetic meal', exact: true }).waitFor()
  assert.equal(await drawer.getByAltText('Submitted meal', { exact: true }).count(), 1, 'failed jobs retain their submitted photo')
  await composer().fill('Draft stays separate')
  await drawer.getByRole('button', { name: 'Retry Second synthetic meal', exact: true }).dblclick()
  await page.waitForFunction(() => document.querySelector('dialog .is-pending'))
  await gateFor('Second synthetic meal')
  assert.equal(submissions.filter(value => value.text === 'Second synthetic meal').length, 2, 'repeated retry starts only one request')
  assert.equal(submissions[1].image, submissions[2].image, 'retry keeps the original submitted photo')
  assert.equal(await composer().inputValue(), 'Draft stays separate')
  ;(await gateFor('Second synthetic meal'))(500)
  await drawer.getByRole('button', { name: 'Dismiss Second synthetic meal', exact: true }).click()
  assert.equal(await drawer.getByText('Second synthetic meal', { exact: true }).count(), 0)
  page.once('dialog', prompt => prompt.dismiss())
  await page.mouse.click(20, 300)
  assert(await drawer.isVisible(), 'backdrop respects unsubmitted drafts')
  await composer().fill('')
  const rect = await drawer.boundingBox()
  await page.mouse.move(rect.x + 30, rect.y + 30)
  await page.mouse.down()
  await page.mouse.move(20, 300)
  await page.mouse.up()
  assert(await drawer.isVisible(), 'dragging out of the drawer must not close it')
  await composer().fill('Saved before refresh failure')
  refreshFails = true
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('dialog .is-pending'))
  ;(await gateFor('Saved before refresh failure'))(200)
  await drawer.getByRole('button', { name: 'Refresh Saved before refresh failure', exact: true }).waitFor()
  const posts = submissions.length
  refreshFails = false
  await drawer.getByRole('button', { name: 'Refresh Saved before refresh failure', exact: true }).dblclick()
  await drawer.getByRole('spinbutton', { name: 'kcal for Saved before refresh failure', exact: true }).waitFor()
  assert.equal(submissions.length, posts, 'retrying a saved job only refreshes; it never POSTs again')
  const queueRefresh = page.waitForResponse(response => new URL(response.url()).pathname === `/api/weight/days/${foodDate}`)
  await composer().fill('New meal after calorie edit')
  await drawer.getByRole('button', { name: 'Add', exact: true }).click()
  await queueRefresh
  await gateFor('New meal after calorie edit')
  holdNextDay = true
  await drawer.getByRole('spinbutton', { name: 'kcal for Synthetic breakfast', exact: true }).fill('410')
  await drawer.getByRole('heading').click()
  await gateFor('older day refresh')
  ;(await gateFor('New meal after calorie edit'))(200)
  const newestMeal = drawer.getByRole('spinbutton', { name: 'kcal for New meal after calorie edit', exact: true })
  await newestMeal.waitFor()
  ;(await gateFor('older day refresh'))()
  await page.waitForFunction(() => !document.querySelector('dialog button[aria-label="Close day"]')?.disabled)
  assert.equal(await newestMeal.count(), 1, 'an older mutation refresh must not overwrite a newer meal list')
  await page.mouse.click(20, 300)
  await drawer.waitFor({ state: 'hidden' })
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay()
  assert((await drawer.boundingBox()).width <= 390)
  assert.deepEqual(errors, [])
  console.log('PASS: concurrent estimates, owner persistence, independent retry/dismiss, refresh-only recovery, latest day refresh, fixed protein, removed controls, guarded backdrop and mobile drawer')
} finally { await browser.close() }
