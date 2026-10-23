// Test-only policy. No runtime network permission is changed.
export interface ObservedRequest { url: string; method: string; body: string | null; kind: string }
export function exactLocalReads(engine: string, bodies: readonly Uint8Array[], payload: Uint8Array): boolean {
  return engine === 'webkit' ? bodies.length === 1 && bodies[0]!.length === payload.length
    && bodies[0]!.every((value, index) => value === payload[index]) : bodies.length === 0;
}
export function requestKind(r: ObservedRequest, engine: string, assets: ReadonlyMap<string, string>): 'asset' | 'local-blob' | 'reject' {
  if (r.method !== 'GET' || r.body !== null) return 'reject';
  const expected = assets.get(r.url);
  // Firefox reports this exact built-in favicon as image rather than other.
  if (engine === 'firefox' && r.url === 'http://127.0.0.1:4173/agent-eval-lab/favicon.svg'
    && expected === 'other' && r.kind === 'image') return 'asset';
  if (expected && (r.kind === expected || (engine === 'webkit' && expected === 'worker' && r.kind === 'xhr')
    || (expected === 'worker' && r.kind === 'script'))) return 'asset';
  // Only a candidate: the observer must also require exactly one response whose
  // bytes equal the single uploaded file. Origin alone never authorizes a blob.
  if (engine === 'webkit' && r.kind === 'xhr'
    && /^blob:http:\/\/127\.0\.0\.1:4173\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.url)) return 'local-blob';
  return 'reject';
}
