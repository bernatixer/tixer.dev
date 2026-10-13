import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { startInactivityLock } from '../src/finance/lifecycle.ts'

function browser(t: TestContext) {
  const window = new EventTarget()
  const document = Object.assign(new EventTarget(), { hidden: false })
  for (const [name, value] of Object.entries({ window, document })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  let elapsed = 0
  t.mock.method(performance, 'now', () => elapsed)
  return {
    window, document,
    tick(ms: number) { elapsed += ms; t.mock.timers.tick(ms) },
    suspend(ms: number, clockRuns = true) {
      if (clockRuns) elapsed += ms
      t.mock.timers.setTime(Date.now() + ms)
    },
    show(hidden: boolean) { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')) },
  }
}

test('ordinary inactivity locks at the configured deadline exactly once', t => {
  const page = browser(t)
  let locks = 0
  t.after(startInactivityLock(() => { locks++ }, 1000))
  page.tick(999)
  assert.equal(locks, 0)
  page.tick(1)
  page.window.dispatchEvent(new Event('focus'))
  page.tick(1000)
  assert.equal(locks, 1)
})

test('a short tab switch keeps the vault open without extending inactivity', t => {
  const page = browser(t)
  let locks = 0
  t.after(startInactivityLock(() => { locks++ }, 1000))
  page.show(true)
  assert.equal(locks, 0)
  page.tick(600)
  page.show(false)
  page.window.dispatchEvent(new Event('focus'))
  assert.equal(locks, 0)
  page.tick(400)
  assert.equal(locks, 1)
})

for (const event of ['pointerdown', 'keydown']) {
  test(`${event} extends inactivity only while visible and before expiration`, t => {
    const page = browser(t)
    let locks = 0
    t.after(startInactivityLock(() => { locks++ }, 1000))
    page.tick(600)
    page.window.dispatchEvent(new Event(event))
    page.tick(600)
    assert.equal(locks, 0)
    page.show(true)
    page.window.dispatchEvent(new Event(event))
    page.tick(400)
    assert.equal(locks, 1)
  })
}

for (const event of ['visibilitychange', 'focus', 'pointerdown', 'keydown']) {
  test(`an overdue ${event} locks before a throttled timer or new activity can revive the vault`, t => {
    const page = browser(t)
    let locks = 0
    t.after(startInactivityLock(() => { locks++ }, 1000))
    page.show(true)
    page.suspend(1000)
    page.document.hidden = false
    const target = event === 'visibilitychange' ? page.document : page.window
    target.dispatchEvent(new Event(event))
    assert.equal(locks, 1)
    page.window.dispatchEvent(new Event('keydown'))
    page.tick(1000)
    assert.equal(locks, 1)
  })
}

test('sleep expires inactivity even when the browser monotonic clock pauses', t => {
  const page = browser(t)
  let locks = 0
  t.after(startInactivityLock(() => { locks++ }, 1000))
  page.suspend(1000, false)
  page.window.dispatchEvent(new Event('focus'))
  assert.equal(locks, 1)
})

test('a backward wall-clock adjustment cannot extend monotonic inactivity', t => {
  const page = browser(t)
  let locks = 0
  t.after(startInactivityLock(() => { locks++ }, 1000))
  page.suspend(1000)
  t.mock.timers.setTime(500)
  page.window.dispatchEvent(new Event('focus'))
  assert.equal(locks, 1)
})

test('cleanup cancels the timer and all activity and resume listeners', t => {
  const page = browser(t)
  let locks = 0
  const stop = startInactivityLock(() => { locks++ }, 1000)
  stop()
  page.tick(1000)
  page.show(true)
  page.show(false)
  for (const event of ['focus', 'pointerdown', 'keydown']) page.window.dispatchEvent(new Event(event))
  page.tick(1000)
  assert.equal(locks, 0)
})
