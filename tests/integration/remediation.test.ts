import { afterEach, expect, test } from 'vitest';
import { access, readFile, utimes } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { runCommand } from '../../src/process/run.js';
import { commandSchema } from '../../src/config/schema.js';
import { snapshot } from '../../src/git/snapshot.js';
import { baseline, clean, cli, command, config, git, temp, write } from '../helpers.js';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await clean(root); });
async function root() { const r = await temp(); roots.push(r); return r; }

test.skipIf(process.platform !== 'win32')('AEL-001 npm arguments remain literal, including the original injection', async () => {
  const r = await root();
  await write(r, 'package.json', JSON.stringify({ scripts: { echo: 'node echo.cjs' } }));
  await write(r, 'echo.cjs', 'console.log(JSON.stringify(process.argv.slice(2)))');
  const args = ['a" & echo AUDIT_SENTINEL>injected.txt & rem "', '한글 space & echo UNEXPECTED | literal', '%PATH%', '!PATH!', '^caret', '', 'a"|echo SECOND>second.txt&rem "'];
  const result = await runCommand(commandSchema.parse({ id: 'args', kind: 'command', command: 'npm', args: ['run', 'echo', '--', ...args] }), r);
  await expect(access(join(r, 'injected.txt'))).rejects.toThrow();
  await expect(access(join(r, 'second.txt'))).rejects.toThrow();
  expect(result.status).toBe('pass');
  expect(JSON.parse(result.stdout!.trim().split('\n').at(-1)!)).toEqual(args);
});

test.skipIf(process.platform !== 'win32')('AEL-001 unknown npm shims and unsafe batch arguments fail before execution', async () => {
  const r = await root(); await write(r, 'npm.cmd', '@echo BAD>marker.txt\r\n'); await write(r, 'custom.cmd', '@echo BAD>marker.txt\r\n');
  for (const name of ['npm.cmd', 'custom.cmd']) {
    const result = await runCommand(commandSchema.parse({ id: 'unsafe', kind: 'command', command: join(r, name), args: ['a" & echo BAD>injected.txt & rem "'] }), r);
    expect(result.status).toBe('error'); expect(result.reason).toContain('Cannot safely');
  }
  await expect(access(join(r, 'marker.txt'))).rejects.toThrow();
  await expect(access(join(r, 'injected.txt'))).rejects.toThrow();
});

test.each(['--assume-unchanged', '--skip-worktree'])('AEL-002 %s fails explicitly and preserves the index', async flag => {
  const r = await root(); await write(r, 'protected.txt', 'ORIGINAL\n');
  await config(r, [command('ok', 'process.exit(0)')], { git: { enabled: true, forbidden: ['protected.txt'] } });
  await baseline(r); await git(r, 'update-index', flag, 'protected.txt');
  await write(r, 'protected.txt', 'FORBIDDEN CONTENT CHANGE\n');
  const index = await readFile(join(r, '.git/index'));
  const result = await cli(r, ['run', '--json']); const report = JSON.parse(result.stdout);
  expect(result.code).toBe(2); expect(report.status).toBe('error'); expect(report.scoreComplete).toBe(false);
  expect(report.checks.at(-1).status).toBe('error'); expect(report.errors[0].message).toMatch(/index flags.*protected\.txt/i);
  expect(await readFile(join(r, '.git/index'))).toEqual(index);
});

test.skipIf(process.platform !== 'win32').each(['timeout', 'cancel'])('AEL-003 limited PATH: %s actually stops the child', async mode => {
  const r = await root(); const old = process.env.PATH; const controller = new AbortController();
  process.env.PATH = dirname(process.execPath);
  const timer = mode === 'cancel' ? setTimeout(() => controller.abort(), 350) : undefined;
  try {
    const result = await runCommand(commandSchema.parse(command('timer', 'require("node:fs").writeFileSync("pid",String(process.pid));setTimeout(()=>require("node:fs").writeFileSync("late.txt","late"),1800)', { timeoutMs: mode === 'timeout' ? 350 : 10000 })), r, controller.signal);
    expect(result.status, JSON.stringify(result)).toBe(mode === 'timeout' ? 'error' : 'skipped');
    expect(result.durationMs).toBeLessThan(1700);
    const pid = Number(await readFile(join(r, 'pid'), 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
    await expect(access(join(r, 'late.txt'))).rejects.toThrow();
  } finally { process.env.PATH = old; clearTimeout(timer); }
});

test('AEL-004 early errors preserve reports and do not create project directories', async () => {
  const r = await root(); await config(r); expect((await cli(r, ['run', '--json'])).code).toBe(0);
  const original = await readFile(join(r, '.agent-eval/report.json'));
  expect((await cli(r, ['init', '--yes'])).code).toBe(2);
  expect(await readFile(join(r, '.agent-eval/report.json'))).toEqual(original);
  const target = await root(); await config(target);
  const invalid = await cli(r, ['run', target, '--bad-flag', '--json']);
  expect(invalid.code).toBe(2); expect(JSON.parse(invalid.stdout).score).toBeNull();
  expect(await readFile(join(r, '.agent-eval/report.json'))).toEqual(original);
  await expect(access(join(target, '.agent-eval'))).rejects.toThrow();
  const missing = join(r, 'typo-project'); expect((await cli(r, ['run', missing, '--json'])).code).toBe(2);
  await expect(access(missing)).rejects.toThrow();
  await write(r, 'agent-eval.yaml', 'version: 99\nchecks: []');
  expect((await cli(r, ['run', '--json'])).code).toBe(2);
  expect(await readFile(join(r, '.agent-eval/report.json'))).toEqual(original);
});

test.each([
  ['false', '', true], ['true', '', false], ['input', '', false],
  ['false', '.env text eol=lf\n', false], ['false', '.env text eol=crlf\n', false],
  ['true', '.env -text\n', true], ['false', '.env text=auto\n', false]
] as const)('AEL-005 restored CRLF matches ordinary diff: autocrlf=%s attributes=%s', async (autocrlf, attributes, changed) => {
  const r = await root(); await git(r, 'init'); await git(r, 'config', 'core.autocrlf', autocrlf);
  await write(r, '.env', 'A=1\n'); if (attributes) await write(r, '.gitattributes', attributes);
  await baseline(r); await write(r, '.env', 'A=1\r\n');
  const ordinary = await snapshot(r, 'HEAD', join(r, 'out.json'));
  expect(ordinary.changes.some(c => c.path === '.env')).toBe(changed);
  await git(r, 'rm', '--cached', '.env'); const index = await readFile(join(r, '.git/index'));
  const restored = await snapshot(r, 'HEAD', join(r, 'out.json'));
  expect(restored.changes).toEqual(ordinary.changes);
  await write(r, '.env', 'A=2\r\n');
  expect((await snapshot(r, 'HEAD', join(r, 'out.json'))).changes).toEqual([{ path: '.env', oldPath: null, status: 'M', additions: 1, deletions: 1, binary: false }]);
  expect(await readFile(join(r, '.git/index'))).toEqual(index);
});

test.each([' leading', 'normal space', ' 한글 경로'])('AEL-006 restored files in nested root %s preserve prefix', async folder => {
  const r = await root(); await write(r, `${folder}/.env`, 'A=1\n'); await baseline(r);
  await git(r, 'rm', '--cached', `${folder}/.env`); await write(r, `${folder}/.env`, 'A=2\n');
  const nested = join(r, folder); await config(nested, [command('ok', 'process.exit(0)')], { git: { enabled: true, forbidden: ['.env'] } });
  const result = await cli(nested, ['run', '--json']); const report = JSON.parse(result.stdout);
  expect(result.code).toBe(1); expect(report.checks.at(-1).status).toBe('fail');
  expect(report.git.changes.find((c: { path: string }) => c.path === '.env')).toMatchObject({ status: 'M', additions: 1, deletions: 1 });
});

test.each(['', '.env text=auto\n', '.env text\n', '.env eol=lf\n', '.env text=auto eol=lf\n'])('AEL-005 an existing CRLF blob keeps ordinary Git semantics: %s', async attributes => {
  const r = await root(); await git(r, 'init'); await git(r, 'config', 'core.autocrlf', 'false');
  await write(r, '.env', 'A=1\r\nB=1\r\n'); await baseline(r); await git(r, 'config', 'core.autocrlf', 'true');
  if (attributes) await write(r, '.gitattributes', attributes);
  // Attributes changed without changing file bytes: invalidate Git's cached
  // stat shortcut so the control actually compares normalized content.
  await utimes(join(r, '.env'), new Date('2020-01-01'), new Date('2020-01-01'));
  const ordinary = await snapshot(r, 'HEAD', join(r, 'out.json'));
  await write(r, '.env', 'A=2\r\nB=1\r\n');
  await utimes(join(r, '.env'), new Date('2020-01-02'), new Date('2020-01-02'));
  const ordinaryEdit = await snapshot(r, 'HEAD', join(r, 'out.json'));
  await git(r, 'rm', '--cached', '.env');
  expect((await snapshot(r, 'HEAD', join(r, 'out.json'))).changes).toEqual(ordinaryEdit.changes);
  await write(r, '.env', 'A=1\r\nB=1\r\n');
  expect((await snapshot(r, 'HEAD', join(r, 'out.json'))).changes).toEqual(ordinary.changes);
});

test('AEL-005 unsupported clean filters fail explicitly without executing project code', async () => {
  const r = await root(); await write(r, 'protected.txt', 'before\n'); await baseline(r);
  await git(r, 'rm', '--cached', 'protected.txt'); await write(r, 'protected.txt', 'after\n');
  await write(r, '.gitattributes', 'protected.txt filter=custom\n');
  await git(r, 'config', 'filter.custom.clean', 'echo BAD > filter-ran.txt');
  await expect(snapshot(r, 'HEAD', join(r, 'out.json'))).rejects.toThrow('Cannot safely normalize');
  await expect(access(join(r, 'filter-ran.txt'))).rejects.toThrow();
});

test('AEL-002 sibling index flags do not escape a nested project boundary', async () => {
  const r = await root(); await write(r, 'nested/a.txt', 'before\n'); await write(r, 'sibling/b.txt', 'before\n'); await baseline(r);
  await git(r, 'update-index', '--skip-worktree', 'sibling/b.txt'); await write(r, 'nested/a.txt', 'after\n');
  const s = await snapshot(join(r, 'nested'), 'HEAD', join(r, 'nested/out.json'));
  expect(s.changes.map(c => c.path)).toEqual(['a.txt']);
});
