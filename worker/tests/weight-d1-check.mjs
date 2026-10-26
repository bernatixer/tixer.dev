import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Exercise the installed Cloudflare runtime, independently of the unit-test SQLite adapter.
const require = createRequire(import.meta.url)
const fromWrangler = createRequire(require.resolve('wrangler/package.json'))
const { Miniflare } = fromWrangler('miniflare')
const { build } = fromWrangler('esbuild')
const { outputFiles } = await build({ stdin: { contents: "export { putWeightGoal } from './src/handlers/weight.ts'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, platform: 'node', format: 'esm', write: false })
const { putWeightGoal } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const runtime = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("local check") } }', d1Databases: { DB: 'weight-final-check' } })
try {
  const db = await runtime.getD1Database('DB')
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8')
  await db.batch(schema.replace(/^\s*--.*$/gm, '').split(';').filter(sql => sql.trim()).map(sql => db.prepare(sql)))
  await db.prepare("INSERT INTO weight_entries VALUES ('local-check', '2020-01-01', 80)").run()
  const save = body => putWeightGoal({ req: { param: () => '2020-01-01', json: async () => ({ targetDate: '2020-03-01', targetWeightKg: 75, ...body }) }, env: { DB: db }, get: () => 'local-check', json: (data, status = 200) => ({ data, status }) })
  assert.equal((await save({ intakeKcal: 1800 })).data.intakeKcal, 1800)
  assert.equal((await save({ targetWeightKg: 90, intakeKcal: 2100 })).status, 400)
  assert.equal((await db.prepare('SELECT intake_kcal FROM weight_goal_intakes').first()).intake_kcal, 1800)
  assert.equal((await save({ intakeKcal: null })).data.intakeKcal, null)
  assert.equal((await save({ intakeKcal: 0 })).data.intakeKcal, 0)
  assert.equal((await save({})).data.intakeKcal, 0)
  await db.prepare("CREATE TRIGGER fail_intake BEFORE UPDATE ON weight_goal_intakes BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END").run()
  await assert.rejects(save({ targetWeightKg: 74, intakeKcal: 2100 }))
  assert.equal((await db.prepare('SELECT target_weight_kg FROM weight_goals').first()).target_weight_kg, 75)
  assert.equal((await db.prepare('SELECT intake_kcal FROM weight_goal_intakes').first()).intake_kcal, 0)
  console.log('PASS: local Cloudflare D1 phase/intake batch guards, null/zero/omitted targets and transactional rollback')
} finally { await runtime.dispose() }
