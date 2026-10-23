import manifest from '../../samples/manifest.json';

export const candidates = manifest.entries;
export type ExampleCandidate = typeof candidates[number];
export function candidateById(id: string): ExampleCandidate | undefined {
  return candidates.find(item => item.id === id);
}
export const exampleKind = (kind: string): string => kind === 'official' ? '공식 실행 기록' : '합성 예제';

type ExampleModule = { payloads: Readonly<Record<string, string>> };
/** Fixed same-origin module only. Abort/deadline release UI state; late module results are ignored. */
export function loadExampleText(id: string, signal: AbortSignal,
  importer: () => Promise<ExampleModule> = () => import('../generated/example-data')): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!candidateById(id) || signal.aborted) { reject(new Error('Example unavailable')); return; }
    let settled = false;
    const finish = (text?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (text === undefined) reject(new Error('Example unavailable')); else resolve(text);
    };
    const abort = () => finish();
    const timer = setTimeout(abort, 5000);
    signal.addEventListener('abort', abort, { once: true });
    void Promise.resolve().then(importer).then(module => finish(module.payloads[id])).catch(abort);
  });
}
