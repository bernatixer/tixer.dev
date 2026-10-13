import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const directory = await mkdtemp(new URL('./.finance-browser-', import.meta.url).pathname);
try {
  const outfile = join(directory, 'browser-server.mjs');
  await build({ entryPoints: [new URL('./browser-server.ts', import.meta.url).pathname], outfile,
    bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'error' });
  process.chdir(fileURLToPath(new URL('../', import.meta.url)));
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
