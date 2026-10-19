import spawn from 'cross-spawn';
import { invocation } from './invocation.js';
import { terminate } from './cleanup.js';
import type { CommandCheck } from '../config/schema.js';
import type { CheckResult } from '../report/types.js';

export const OUTPUT_LIMIT = 65536; // Per stream, bytes; always drain pipes after the limit.
export async function runCommand(check: CommandCheck, cwd: string, signal?: AbortSignal): Promise<CheckResult> {
  const start = Date.now();
  const base: CheckResult = { id: check.id, label: check.label ?? check.id, kind: 'command', required: check.required,
    status: 'skipped', durationMs: 0, exitCode: null, reason: 'Cancelled before execution', command: check.command, args: check.args, timedOut: false };
  if (signal?.aborted) return base;
  let resolved: { command: string; args: string[] };
  try { resolved = await invocation(check.command, check.args, cwd); }
  catch (error) { return { ...base, status: 'error', durationMs: Date.now() - start, reason: `Could not start: ${String(error)}` }; }
  if (signal?.aborted) return base;
  return new Promise(resolve => {
    const buffers = { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    let truncated = false, timedOut = false, cancelled = false;
    let launchError: Error | undefined;
    let cleanup: Promise<string | null> | undefined;
    let cleanupError: string | null = null, closed = false, finished = false;
    let drainTimer: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(resolved.command, resolved.args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    const finish = () => {
      if (finished) return; finished = true;
      clearTimeout(timer); clearTimeout(drainTimer); signal?.removeEventListener('abort', onAbort);
      const code = child.exitCode, childSignal = child.signalCode;
      const status = cleanupError ? 'error' : cancelled ? 'skipped' : launchError || timedOut || childSignal ? 'error' : code === 0 ? 'pass' : 'fail';
      const reason = cancelled ? 'Cancelled by SIGINT' : launchError ? `Could not start: ${launchError.message}` : timedOut ? `Timed out after ${check.timeoutMs}ms` : childSignal ? `Unexpected signal: ${childSignal}` : code !== 0 ? `Command exited with code ${code}` : null;
      resolve({ ...base, status, durationMs: Date.now() - start, exitCode: code, reason: cleanupError ? `${reason ?? 'Execution stopped'}; cleanup: ${cleanupError}` : reason, timedOut, signal: childSignal,
        stdout: buffers.stdout.toString('utf8'), stderr: buffers.stderr.toString('utf8'), outputTruncated: truncated });
    };
    const stop = () => {
      if (cleanup || !child.pid) return;
      cleanup = terminate(child);
      void cleanup.then(error => {
        cleanupError = error;
        if (closed) finish();
        else drainTimer = setTimeout(() => {
          cleanupError ??= 'Process stdio did not close; descendant cleanup NOT confirmed';
          child.stdout?.destroy(); child.stderr?.destroy(); child.unref(); finish();
        }, 500);
      });
    };
    const onAbort = () => { cancelled = true; stop(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    // Node clamps large timer values to 1ms; schedule long deadlines in chunks.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = check.timeoutMs - (Date.now() - start);
      if (remaining <= 0) { timedOut = true; stop(); }
      else timer = setTimeout(schedule, Math.min(remaining, 2147483647));
    };
    schedule();
    if (signal?.aborted) onAbort();
    for (const stream of ['stdout', 'stderr'] as const) child[stream]?.on('data', (data: Buffer) => {
      const remaining = OUTPUT_LIMIT - buffers[stream].length;
      if (data.length > remaining) truncated = true;
      if (remaining > 0) buffers[stream] = Buffer.concat([buffers[stream], data.subarray(0, remaining)]);
    });
    child.on('error', error => { launchError = error; });
    child.on('close', () => {
      closed = true; clearTimeout(timer);
      if (cleanup) void cleanup.then(error => { cleanupError = error; finish(); });
      else finish();
    });
  });
}
