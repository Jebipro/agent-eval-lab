import { mkdtemp, readFile, writeFile, mkdir, cp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, dirname, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import spawn from 'cross-spawn';
const source = resolve('.');
const temporary = await mkdtemp(join(tmpdir(), 'agent-eval-consumer 한글 space-'));
const run = (cmd, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = ''; child.stdout.on('data', d => stdout += d); child.stderr.on('data', d => stderr += d); child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
});
const success = async (cmd, args, cwd) => { const r = await run(cmd, args, cwd); assert.equal(r.code, 0, `${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`); return r; };
const timings = { os: process.platform, node: process.version, packageCache: 'npm cache allowed; no cold-cache guarantee', registryFirstDownloadMs: null };
try {
  assert(relative(source, temporary).startsWith('..'), 'Consumer must be outside source repository');
  const pack = await success('npm', ['pack', '--json'], source);
  const packed = JSON.parse(pack.stdout.slice(pack.stdout.lastIndexOf('\n[') + 1))[0];
  const tarball = resolve(source, packed.filename);
  assert(packed.files.some(f => f.path === 'dist/cli/index.js'));
  assert(packed.files.some(f => f.path === 'README.md'));
  assert(!packed.files.some(f => /^(src|tests|fixtures|node_modules|\.agent-eval)\//.test(f.path)), 'Package contains development/private files');
  const consumer = join(temporary, 'consumer'); await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), '{"name":"consumer","private":true}');
  let started = performance.now();
  await success('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--fetch-retries=0', tarball], consumer);
  timings.consumerInstallMs = Math.round(performance.now() - started);
  const installed = join(consumer, 'node_modules/agent-eval-lab');
  const installedPackage = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert(!installedPackage.scripts.install && !installedPackage.scripts.postinstall && !installedPackage.scripts.prepare);
  for (const path of ['src', 'node_modules/typescript']) await assert.rejects(access(join(installed, path)));
  await assert.rejects(readFile(join(consumer, 'node_modules/typescript/package.json')));
  for (const entry of packed.files.filter(f => f.path.endsWith('.js'))) {
    const file = join(installed, entry.path); const code = await readFile(file, 'utf8');
    assert(!code.includes(source) && !code.includes(source.replaceAll('\\', '/')), 'Built output references the source checkout');
    for (const match of code.matchAll(/\b(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      assert(!isAbsolute(specifier) && !specifier.startsWith('file:') && !/\.tsx?$|^(?:tsx|ts-node)(?:\/|$)/.test(specifier), `Source/development import in ${entry.path}: ${specifier}`);
      if (specifier.startsWith('.')) assert(!relative(installed, resolve(dirname(file), specifier)).startsWith('..'), 'Relative runtime import escapes installed package');
    }
  }
  const { reportSchema } = await import(pathToFileURL(join(installed, 'dist/report/schema.js')).href);
  const bin = join(consumer, 'node_modules/.bin', process.platform === 'win32' ? 'agent-eval-lab.cmd' : 'agent-eval-lab');
  assert((await success(bin, ['--help'], consumer)).stdout.includes('Agent Eval Lab'));
  assert.equal((await success(bin, ['--version'], consumer)).stdout.trim(), '0.1.0');
  const project = join(temporary, 'fixture 한글 space'); await cp(join(source, 'fixtures/small-project'), project, { recursive: true });
  started = performance.now(); await success('npm', ['ci', '--no-audit', '--no-fund', '--fetch-retries=0'], project); timings.fixtureDependencyInstallMs = Math.round(performance.now() - started);
  started = performance.now();
  await success(bin, ['init', '--yes'], project);
  const terminal = await success(bin, ['run', '--non-interactive'], project);
  let report = JSON.parse(await readFile(join(project, '.agent-eval/report.json'), 'utf8')); reportSchema.parse(report); assert.equal(report.status, 'passed');
  timings.initRunAndReadMs = Math.round(performance.now() - started); assert(timings.initRunAndReadMs < 120000, 'Prepared fixture exceeded two-minute UX target');
  const jsonResult = await success(bin, ['run', '--json'], project); report = JSON.parse(jsonResult.stdout); reportSchema.parse(report); assert.deepEqual(report, JSON.parse(await readFile(join(project, '.agent-eval/report.json'), 'utf8')));
  await writeFile(join(project, 'src/add.ts'), 'export function add(a:number,b:number):number { return a-b; }');
  let result = await run(bin, ['run', '--json'], project); assert.equal(result.code, 1); reportSchema.parse(JSON.parse(result.stdout)); assert.equal(JSON.parse(result.stdout).checks[0].status, 'fail');
  await writeFile(join(project, 'agent-eval.yaml'), 'version: 1\nchecks:\n  - id: missing\n    kind: command\n    command: agent-eval-missing-executable-19842\n');
  result = await run(bin, ['run', '--json'], project); assert.equal(result.code, 2); reportSchema.parse(JSON.parse(result.stdout));
  await writeFile(join(project, 'agent-eval.yaml'), 'version: 99\nchecks: []\n');
  result = await run(bin, ['run', '--json'], project); assert.equal(result.code, 2); reportSchema.parse(JSON.parse(result.stdout)); assert.equal(JSON.parse(result.stdout).score, null);
  await mkdir(join(source, 'docs'), { recursive: true });
  const record = { measuredAt: new Date().toISOString(), ...timings, fixtureDependenciesPreparedBeforeTiming: true, sourceOrDevRunnerRequired: false, tarball: packed.filename, tarballFiles: packed.files.map(f => f.path), checks: ['installed bin help/version', 'init and successful run', 'report schema', 'assertion failure exit 1', 'execution error exit 2', 'configuration error exit 2', 'single JSON stdout and saved equality', 'no consumer build/dev dependencies'], terminal: terminal.stdout.replaceAll(project, '<project>') };
  await writeFile(join(source, 'docs/package-verification.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record, null, 2));
} finally {
  const resolved = resolve(temporary);
  assert(resolved.startsWith(resolve(tmpdir())) && resolved !== resolve(tmpdir()) && resolved.includes('agent-eval-consumer '));
  await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
}
