import { afterEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { terminate } from '../../src/process/cleanup.js';
import { runCommand } from '../../src/process/run.js';
import { commandSchema } from '../../src/config/schema.js';
import { clean, command, temp } from '../helpers.js';

const fault = vi.hoisted(() => ({ mode: 'nonzero' }));
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: (...args: Parameters<typeof actual.spawn>) => {
    if (!String(args[0]).endsWith('taskkill.exe')) return actual.spawn(...args);
    const child = new EventEmitter() as ChildProcess;
    child.kill = () => { if (fault.mode === 'hung-kill-failure') throw new Error('simulated kill failure'); return true; }; child.unref = () => undefined;
    if (fault.mode === 'missing') queueMicrotask(() => child.emit('error', Object.assign(new Error('simulated ENOENT'), { code: 'ENOENT' })));
    if (fault.mode === 'nonzero') queueMicrotask(() => child.emit('close', 1));
    return child;
  } };
});
const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const r of roots.splice(0)) await clean(r); });

test.skipIf(process.platform !== 'win32').each(['missing', 'nonzero', 'hung', 'hung-kill-failure'])('AEL-003 taskkill %s uses a bounded real-child fallback and reports uncertainty', async mode => {
  fault.mode = mode; const r = await temp(); roots.push(r);
  const result = await runCommand(commandSchema.parse(command('stop', 'require("node:fs").writeFileSync("pid",String(process.pid));setTimeout(()=>{},10000)', { timeoutMs: 350 })), r);
  const pid = Number(await readFile(join(r, 'pid'), 'utf8'));
  try {
    expect(result.status).toBe('error'); expect(result.durationMs).toBeLessThan(4500);
    expect(result.reason).toContain('process tree cleanup NOT confirmed');
    if (mode === 'hung-kill-failure') expect(result.reason).toContain('cleanup helper termination NOT confirmed');
    expect(() => process.kill(pid, 0)).toThrow();
  } finally { try { process.kill(pid, 'SIGKILL'); } catch { /* already stopped */ } }
});

test.skipIf(process.platform !== 'win32')('AEL-003 cancellation with failed taskkill records cleanup failure and stops the direct child', async () => {
  fault.mode = 'nonzero'; const r = await temp(); roots.push(r); const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 350);
  try {
    const result = await runCommand(commandSchema.parse(command('cancel', 'require("node:fs").writeFileSync("pid",String(process.pid));setTimeout(()=>{},10000)')), r, controller.signal);
    expect(result.status).toBe('error'); expect(result.reason).toMatch(/Cancelled by SIGINT.*cleanup/);
    const pid = Number(await readFile(join(r, 'pid'), 'utf8')); expect(() => process.kill(pid, 0)).toThrow();
  } finally { clearTimeout(timer); }
});

test.skipIf(process.platform !== 'win32')('AEL-003 an unkillable child is never described as terminated', async () => {
  fault.mode = 'nonzero';
  const child = new EventEmitter() as ChildProcess;
  Object.assign(child, { pid: 2147483647, exitCode: null, signalCode: null, kill: () => false });
  const started = Date.now(); const result = await terminate(child);
  expect(Date.now() - started).toBeLessThan(2000);
  expect(result).toContain('direct child termination NOT confirmed');
});
