import { importError, isErrorCode, type Issue } from './errors';
import { LIMITS, isRecord } from './limits';
import type { ParseResult } from './parse';
import type { ParseRequest, ParseResponse } from './protocol';

export interface WorkerPort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: ParseRequest): void;
  terminate(): void;
}
export type WorkerFactory = () => WorkerPort;
const makeWorker: WorkerFactory = () => new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });

// Only an application-owned Worker is accepted. It validates the full report before posting.
// This guards the transport envelope, not a second unbounded main-thread schema validation.
function response(value: unknown, id: number): ParseResponse | null {
  if (!isRecord(value) || value.protocol !== 1 || value.id !== id || !isRecord(value.result)) return null;
  const result = value.result;
  if (result.ok === true && isRecord(result.report) && result.report.schemaVersion === 1) return value as unknown as ParseResponse;
  if (result.ok === false && isRecord(result.error) && isErrorCode(result.error.code)) {
    const issues: Issue[] = [];
    if (!Array.isArray(result.error.issues) || result.error.issues.length > 20) return null;
    for (const issue of result.error.issues) {
      if (!isRecord(issue) || typeof issue.path !== 'string' || issue.path.length > 256
        || typeof issue.keyword !== 'string' || issue.keyword.length > 64) return null;
      issues.push({ path: issue.path, keyword: issue.keyword });
    }
    return { protocol: 1, id, result: { ok: false, error: importError(result.error.code, issues) } };
  }
  return null;
}

export class ImportController {
  private sequence = 0;
  private stop: (() => void) | undefined;
  constructor(private readonly factory: WorkerFactory = makeWorker) {}
  cancel(): void { this.stop?.(); }
  import(file: Blob): Promise<ParseResult> {
    this.cancel();
    if (file.size > LIMITS.bytes) return Promise.resolve({ ok: false, error: importError('ResourceLimitError') });
    const id = ++this.sequence;
    return new Promise(resolve => {
      let worker: WorkerPort;
      try { worker = this.factory(); }
      catch { resolve({ ok: false, error: importError('WorkerError') }); return; }
      let finished = false;
      const finish = (result: ParseResult): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
        try { worker.terminate(); } catch { /* No raw exception or user data is logged. */ }
        if (this.stop === stop) this.stop = undefined;
        resolve(result);
      };
      const stop = (): void => finish({ ok: false, error: importError('Cancelled') });
      const timer = setTimeout(() => finish({ ok: false, error: importError('ResourceLimitError') }), LIMITS.workerMs);
      this.stop = stop;
      worker.onmessage = event => {
        if (isRecord(event.data) && Number.isSafeInteger(event.data.id) && event.data.id !== id) return;
        const message = response(event.data, id);
        finish(message?.result ?? { ok: false, error: importError('WorkerError') });
      };
      worker.onerror = event => { event.preventDefault(); finish({ ok: false, error: importError('WorkerError') }); };
      worker.onmessageerror = () => finish({ ok: false, error: importError('WorkerError') });
      try { worker.postMessage({ protocol: 1, id, file }); }
      catch { finish({ ok: false, error: importError('WorkerError') }); }
    });
  }
}
