import { importError } from './errors';
import { isRecord } from './limits';
import { parseFile, type ParseResult } from './parse';
import type { ParseResponse } from './protocol';

export async function handleRequest(input: unknown, parse: (file: Blob) => Promise<ParseResult> = parseFile): Promise<ParseResponse> {
  const id = isRecord(input) && Number.isSafeInteger(input.id) && typeof input.id === 'number' && input.id > 0 ? input.id : 0;
  const failure = (): ParseResponse => ({ protocol: 1, id, result: { ok: false, error: importError('WorkerError') } });
  if (!isRecord(input) || input.protocol !== 1 || id === 0 || !(input.file instanceof Blob)) return failure();
  try { return { protocol: 1, id, result: await parse(input.file) }; }
  catch { return failure(); }
}
