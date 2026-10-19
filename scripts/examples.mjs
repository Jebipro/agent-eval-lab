import { mkdtemp, mkdir, cp, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import spawn from 'cross-spawn';
import { stringify } from 'yaml';
const source = resolve('.'); const root = await mkdtemp(join(tmpdir(), 'agent-eval-examples-'));
// Public examples keep real results, but omit machine-specific source/fixture paths.
const publicText = text => {
  for (const [path, label] of [[root, '<project>'], [source, '<source>']]) {
    text = text.replaceAll(path, label).replaceAll(path.replaceAll('\\', '/'), label);
  }
  return text;
};
const run = (cmd, args, cwd) => new Promise((resolve, reject) => { const c = spawn(cmd, args, { cwd, windowsHide: true }); let stdout = '', stderr = ''; c.stdout.on('data', d => stdout += d); c.stderr.on('data', d => stderr += d); c.on('error', reject); c.on('close', code => resolve({ code, stdout, stderr })); });
const cli = args => run(process.execPath, [join(source, 'dist/cli/index.js'), ...args], root);
try {
  await cp(join(source, 'fixtures/small-project'), root, { recursive: true });
  await symlink(join(source, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await cli(['init', '--yes'])).code, 0);
  const original = await readFile(join(root, 'agent-eval.yaml'), 'utf8'); const originalCode = await readFile(join(root, 'src/add.ts'), 'utf8');
  await mkdir(join(source, 'examples/reports'), { recursive: true });
  const capture = async (name, expected) => { const r = await cli(['run', '--json']); assert.equal(r.code, expected, r.stdout + r.stderr); const report = JSON.parse(r.stdout); await writeFile(join(source, `examples/reports/${name}.json`), JSON.stringify(report, (_key, value) => typeof value === 'string' ? publicText(value) : value, 2) + '\n'); console.log(`${name}: exit ${r.code}`); };
  await capture('success-no-git', 0);
  const terminal = await cli(['run']); await writeFile(join(source, 'examples/terminal.txt'), publicText(terminal.stdout));
  await writeFile(join(root, 'src/add.ts'), 'export function add(a:number,b:number):number { return a-b; }'); await capture('test-failure', 1);
  await writeFile(join(root, 'src/add.ts'), 'export function add(a:number,b:number):number { return "bad"; }'); await capture('type-error', 1);
  await writeFile(join(root, 'src/add.ts'), originalCode);
  await writeFile(join(root, 'agent-eval.yaml'), stringify({ version: 1, checks: [{ id: 'requirements', kind: 'command', command: 'npm', args: ['run', 'check:requirements'] }] })); await capture('requirements', 0);
  await writeFile(join(root, 'agent-eval.yaml'), stringify({ version: 1, checks: [{ id: 'missing', kind: 'command', command: 'agent-eval-missing-command-12345' }] })); await capture('execution-error', 2);
  await writeFile(join(root, 'agent-eval.yaml'), stringify({ version: 1, checks: [{ id: 'timeout', kind: 'command', command: 'node', args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 100 }] })); await capture('timeout', 2);
  await writeFile(join(root, '.env.example'), 'before\n');
  for (const args of [['init'], ['add', '.'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'baseline']]) { const r = await run('git', args, root); assert.equal(r.code, 0, r.stderr); }
  await writeFile(join(root, '.env.example'), 'after\n');
  await writeFile(join(root, 'agent-eval.yaml'), original.replace('enabled: false', 'enabled: true').replace('forbidden: []', 'forbidden: ["**/.env.*"]'));
  await capture('forbidden-file', 1);
} finally { assert(root.startsWith(resolve(tmpdir())) && root.includes('agent-eval-examples-')); await rm(root, { recursive: true, force: true, maxRetries: 3 }); }
