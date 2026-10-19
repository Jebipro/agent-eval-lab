import { afterEach, expect, test } from 'vitest';
import { runCommand, OUTPUT_LIMIT } from '../../src/process/run.js';
import { commandSchema } from '../../src/config/schema.js';
import { temp, clean, command, write } from '../helpers.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const roots: string[] = []; afterEach(async () => { for (const r of roots.splice(0)) await clean(r); });
const root = async () => { const r = await temp(); roots.push(r); return r; };
test('real pass, failure, missing executable, bounded output', async () => {
  const cwd = await root();
  expect((await runCommand(commandSchema.parse(command('pass', 'process.exit(0)')), cwd)).status).toBe('pass');
  expect((await runCommand(commandSchema.parse(command('fail', 'process.exit(3)')), cwd)).exitCode).toBe(3);
  expect((await runCommand(commandSchema.parse({ id: 'missing', kind: 'command', command: 'agent-eval-nonexistent-executable-9921' }), cwd)).status).toBe('error');
  const large = await runCommand(commandSchema.parse(command('large', 'process.stdout.write("x".repeat(1000000));process.stderr.write("z".repeat(1000000))')), cwd);
  expect(large.stdout?.length).toBe(OUTPUT_LIMIT); expect(large.stderr?.length).toBe(OUTPUT_LIMIT); expect(large.outputTruncated).toBe(true);
});
test('timeout kills a descendant process', async () => {
  const cwd = await root();
  const script = 'const {spawn}=require("node:child_process"); const {writeFileSync}=require("node:fs"); const c=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"}); writeFileSync("child.pid",String(c.pid));setInterval(()=>{},1000)';
  const result = await runCommand(commandSchema.parse(command('timeout', script, { timeoutMs: 1000 })), cwd);
  expect(result.status).toBe('error'); expect(result.timedOut).toBe(true);
  const pid = Number(await readFile(join(cwd, 'child.pid'), 'utf8')); expect(() => process.kill(pid, 0)).toThrow();
});
test('abort cleans process and reports skipped; future check does not start', async () => {
  const cwd = await root(); const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300);
  const result = await runCommand(commandSchema.parse(command('cancel', 'setInterval(()=>{},1000)')), cwd, controller.signal); clearTimeout(timer);
  expect(result.status, JSON.stringify(result)).toBe('skipped'); expect(result.reason).toContain('SIGINT');
  expect((await runCommand(commandSchema.parse(command('later', 'throw Error("must not run")')), cwd, controller.signal)).reason).toContain('before');
});
test('arguments containing metacharacters are passed literally', async () => {
  const cwd = await root(); const arg = '한글 space & echo INJECTED | %PATH% "quote"';
  const c = commandSchema.parse({ id: 'args', kind: 'command', command: process.execPath, args: ['-e', 'console.log(process.argv[1])', arg] });
  expect((await runCommand(c, cwd)).stdout?.trim()).toBe(arg);
});
test('Windows npm shim receives spaced Unicode arguments without shell injection', async () => {
  const cwd = await root();
  await write(cwd, 'package.json', JSON.stringify({ scripts: { echo: 'node args.cjs' } }));
  await write(cwd, 'args.cjs', 'console.log(JSON.stringify(process.argv.slice(2)))');
  const argument = '한글 space & echo UNEXPECTED | literal';
  const c = commandSchema.parse({ id: 'npm-args', kind: 'command', command: 'npm', args: ['run', 'echo', '--', argument] });
  const result = await runCommand(c, cwd); expect(result.status).toBe('pass'); expect(result.stdout?.trim().split('\n').at(-1)).toBe(JSON.stringify([argument]));
});
test.skipIf(process.platform === 'win32')('unexpected child signal is error', async () => { const cwd = await root(); const result = await runCommand(commandSchema.parse(command('signal', 'process.kill(process.pid,"SIGTERM")')), cwd); expect(result.status).toBe('error'); expect(result.signal).toBe('SIGTERM'); });
test('large positive timeout does not overflow into an immediate timeout', async () => { const cwd = await root(); const result = await runCommand(commandSchema.parse(command('long-limit', 'process.exit(0)', { timeoutMs: 3000000000 })), cwd); expect(result.status).toBe('pass'); expect(result.timedOut).toBe(false); });
