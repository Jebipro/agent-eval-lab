import validate from '../generated/validate.js';
import type { ReadonlyReport } from '../report/types';
import { importError, type ImportError } from './errors';
import { isRecord, LIMITS, withinStructureLimits } from './limits';

export type ParseResult = { readonly ok: true; readonly report: ReadonlyReport }
  | { readonly ok: false; readonly error: ImportError };
const fail = (code: ImportError['code']): ParseResult => ({ ok: false, error: importError(code) });

/** Called in a dedicated browser Worker. Does not mutate, normalize, score, or execute input. */
export function parseBytes(bytes: Uint8Array): ParseResult {
  if (bytes.byteLength > LIMITS.bytes) return fail('ResourceLimitError');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return fail('DecodeError'); }
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { return fail('ParseError'); } // Never expose native error snippets containing report data.
  if (isRecord(data) && typeof data.schemaVersion === 'number' && data.schemaVersion !== 1) return fail('UnsupportedVersion');
  if (!withinStructureLimits(data)) return fail('ResourceLimitError');
  if (!validate(data)) {
    return { ok: false, error: importError('SchemaError', (validate.errors ?? []).slice(0, 20).map(e => ({
      path: e.instancePath.slice(0, 256), keyword: e.keyword.slice(0, 64)
    }))) };
  }
  return { ok: true, report: data };
}

export async function parseFile(file: Blob): Promise<ParseResult> {
  if (file.size > LIMITS.bytes) return fail('ResourceLimitError');
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { return fail('ReadError'); }
  return parseBytes(new Uint8Array(bytes));
}
