import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const directory = await mkdtemp(new URL('./.finance-test-', import.meta.url).pathname);
try {
  const outfile = join(directory, 'finance.test.mjs');
  await build({ entryPoints: [new URL('./finance.test.ts', import.meta.url).pathname], outfile,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'error' });
  const result = spawnSync(process.execPath, ['--test', outfile], {
    stdio: 'inherit', cwd: new URL('../', import.meta.url),
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
