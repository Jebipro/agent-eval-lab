import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [mode, suite, ...args] = process.argv.slice(2);
if (!['public', 'private'].includes(mode) || !['unit', 'browser'].includes(suite)) throw new Error('Expected public|private unit|browser');
const cwd = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, AEL_FIXTURE_MODE: mode };
function run(script, options = []) {
  const result = spawnSync(process.execPath, [script, ...options], { cwd, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('scripts/generate-validator.mjs');
run('scripts/generate-examples.mjs');
run('scripts/verify-fixtures.mjs', mode === 'private' ? ['--private'] : []);
console.log(`Test data mode: ${mode.toUpperCase()} — same assertions, explicitly selected data set.`);
run(suite === 'unit' ? 'node_modules/vitest/vitest.mjs' : 'node_modules/@playwright/test/cli.js',
  [suite === 'unit' ? 'run' : 'test', ...args]);
