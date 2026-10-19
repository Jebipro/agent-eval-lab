import { afterEach, expect, test } from 'vitest';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { reportSchema } from '../../src/report/schema.js';
import { temp, clean, write, config, command, cli, fixture, baseline } from '../helpers.js';
const roots: string[] = []; afterEach(async () => { for (const r of roots.splice(0)) await clean(r); });
async function root() { const r = await temp(); roots.push(r); return r; }
test('help, version, invalid option, missing config, no prompt', async () => {
  const r = await root(); expect((await cli(r, ['--help'])).stdout).toContain('project root'); expect((await cli(r, ['--version'])).stdout.trim()).toBe('0.1.0');
  for (const args of [['run', '--json'], ['run', '--unknown', '--json']]) { const result = await cli(r, args); expect(result.code).toBe(2); const data = JSON.parse(result.stdout); expect(reportSchema.safeParse(data).success).toBe(true); expect(data.score).toBeNull(); }
});
test('init creates valid config, refuses overwrite, supports force, never runs checks', async () => {
  const r = await root(); await write(r, 'package.json', JSON.stringify({ scripts: { test: 'node -e "process.exit(99)"' } }));
  expect((await cli(r, ['init', '--yes'])).code).toBe(0); expect((await cli(r, ['init', '--yes'])).code).toBe(2); expect((await cli(r, ['init', '--yes', '--force'])).code).toBe(0);
});
test('paths resolve from project root and JSON/file share same result', async () => {
  const parent = await root(); const r = join(parent, 'project 한글 space'); await mkdir(r); await config(r); await write(r, 'custom.yaml', await readFile(join(r, 'agent-eval.yaml'), 'utf8'));
  const result = await cli(parent, ['run', 'project 한글 space', '--config', 'custom.yaml', '--report', 'output/result.json', '--json']); expect(result.code).toBe(0); const data = JSON.parse(result.stdout); expect(reportSchema.safeParse(data).success).toBe(true); expect(JSON.parse(await readFile(join(r, 'output/result.json'), 'utf8'))).toEqual(data); expect(data.project).not.toHaveProperty('path');
});
test('failure continues, optional failure affects score, errors take priority', async () => {
  const r = await root(); await config(r, [command('optional', 'process.exit(1)', { required: false }), command('pass', 'process.exit(0)')]); let result = await cli(r, ['run', '--json']); expect(result.code).toBe(0); expect(JSON.parse(result.stdout).score).toBe(50);
  await config(r, [command('fail', 'process.exit(1)'), command('pass', 'process.exit(0)'), { id: 'missing', kind: 'command', command: 'missing-agent-eval-tool-19999' }]); result = await cli(r, ['run', '--json']); expect(result.code).toBe(2); expect(JSON.parse(result.stdout).checks.map((c: { status: string }) => c.status)).toEqual(['fail', 'pass', 'error']);
});
test('invalid YAML and schema errors retain JSON envelope', async () => { const r = await root(); for (const yaml of ['checks: [', 'version: 2\nchecks: []', 'version: 1\nchecks: []\nextra: true']) { await write(r, 'agent-eval.yaml', yaml); const result = await cli(r, ['run', '--json']); expect(result.code).toBe(2); expect(reportSchema.safeParse(JSON.parse(result.stdout)).success).toBe(true); } });
test('write errors and protected source files are reported without overwriting', async () => {
  const r = await root(); await config(r); await write(r, 'package.json', '{"name":"preserve"}'); let result = await cli(r, ['run', '--report', 'package.json', '--json']); expect(result.code).toBe(2); expect(await readFile(join(r, 'package.json'), 'utf8')).toBe('{"name":"preserve"}'); expect(JSON.parse(result.stdout).errors.some((e: { code: string }) => e.code === 'REPORT_WRITE_ERROR')).toBe(true);
  await write(r, 'blocked', 'file'); result = await cli(r, ['run', '--report', 'blocked/report.json', '--json']); expect(result.code).toBe(2); expect(JSON.parse(result.stdout).status).toBe('error');
});
test('Git snapshot precedes commands and forbidden gate catches tracked edit', async () => {
  const r = await root(); await write(r, '.env.example', 'before\n'); await baseline(r); await write(r, '.env.example', 'after\n'); await config(r, [command('write', 'require("node:fs").writeFileSync("generated.txt","late")')], { git: { enabled: true, forbidden: ['**/.env.*'] } });
  const result = await cli(r, ['run', '--json']); const data = JSON.parse(result.stdout); expect(result.code).toBe(1); expect(data.checks.at(-1).status).toBe('fail'); expect(data.git.changes.some((c: { path: string }) => c.path === 'generated.txt')).toBe(false);
});
test('invalid Git base produces gate error but still runs commands', async () => { const r = await root(); await config(r, [command('pass', 'process.exit(0)')], { git: { enabled: true, base: 'missing', forbidden: ['*'] } }); const result = await cli(r, ['run', '--json']); const data = JSON.parse(result.stdout); expect(result.code).toBe(2); expect(data.checks.map((c: { status: string }) => c.status)).toEqual(['pass', 'error']); });
test('absolute paths, base override and disabled forbidden gate', async () => { const r = await root(); await write(r, 'file.txt', 'original'); await baseline(r); await config(r, [command('pass', 'process.exit(0)')], { git: { enabled: true, base: 'missing', forbidden: [] } }); const result = await cli(r, ['run', '--config', join(r, 'agent-eval.yaml'), '--report', join(r, 'output/report.json'), '--base', 'HEAD', '--json']); const data = JSON.parse(result.stdout); expect(result.code).toBe(0); expect(data.git.baseRef).toBe('HEAD'); expect(data.checks).toHaveLength(1); expect(await readFile(join(r, 'agent-eval.yaml'), 'utf8')).toContain('missing'); });
test('write failure after successful checks changes final JSON status', async () => { const r = await root(); await config(r, [command('block', 'require("node:fs").writeFileSync("late-block","x")')]); const result = await cli(r, ['run', '--report', 'late-block/report.json', '--json']); const data = JSON.parse(result.stdout); expect(result.code).toBe(2); expect(data.checks[0].status).toBe('pass'); expect(data.score).toBe(100); expect(data.scoreComplete).toBe(false); expect(data.errors.at(-1).code).toBe('REPORT_WRITE_ERROR'); });
test('non-TTY init without yes fails promptly; ANSI child output never escapes JSON framing', async () => { const r = await root(); await write(r, 'package.json', JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } })); const init = await cli(r, ['init']); expect(init.code).toBe(2); expect(init.stderr).not.toContain('Accept this configuration?'); await config(r, [command('ansi', 'console.log("\\x1b[31mred\\x1b[0m")')]); const result = await cli(r, ['run', '--json']); expect(result.stdout).not.toContain('\x1b'); expect(JSON.parse(result.stdout).checks[0].stdout).toContain('red'); });
test('real TypeScript/Vitest fixture succeeds and exposes actual test/type failures', async () => {
  const r = await fixture(); roots.push(r); expect((await cli(r, ['init', '--yes'])).code).toBe(0); expect((await cli(r, ['run', '--non-interactive', '--json'])).code).toBe(0);
  await write(r, 'src/add.ts', 'export function add(a: number,b: number): number { return a - b; }'); let result = await cli(r, ['run', '--json']); expect(result.code).toBe(1); expect(JSON.parse(result.stdout).checks[0].status).toBe('fail');
  await write(r, 'src/add.ts', 'export function add(a: number,b: number): number { return "wrong"; }'); result = await cli(r, ['run', '--json']); expect(result.code).toBe(1); expect(JSON.parse(result.stdout).checks[1].status).toBe('fail');
});
