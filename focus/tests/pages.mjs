import assert from 'node:assert/strict'

const base = process.env.FINANCE_PREVIEW_URL || 'http://127.0.0.1:3002'
const direct = await fetch(`${base}/finance.html`, { redirect: 'manual' })
assert.equal(direct.status, 200, 'Finance must load without the Pages extensionless redirect loop')
const finance = await direct.text()
assert.match(finance, /\/assets\/finance-[^" ]+\.js/, 'Finance must load its dedicated entry')
assert.equal(direct.headers.get('cache-control'), 'no-store')
assert.equal(direct.headers.get('referrer-policy'), 'no-referrer')

for (const path of ['/finance', '/finance/check-in', '/money', '/money/check-in']) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, `${path} must resolve successfully`)
  assert.equal(new URL(response.url).pathname, '/finance.html')
  assert.equal(await response.text(), finance, `${path} must serve Finance, not Todo`)
}

const root = await (await fetch(`${base}/`)).text()
assert.match(root, /\/assets\/focus-[^" ]+\.js/, 'Todo must retain its entry')
assert.equal(await (await fetch(`${base}/sso-callback`)).text(), root, 'Pages must retain SPA fallback')
const asset = finance.match(/src="([^" ]+\.js)"/)[1]
const script = await fetch(new URL(asset, base))
assert.equal(script.status, 200)
assert.match(script.headers.get('content-type'), /javascript/, 'Redirects must not override static assets')
console.log('PASS: Pages finance aliases, dedicated assets, privacy headers, and Todo SPA fallback')
