import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { configSchema, type Config } from './schema.js';
export async function loadConfig(path: string): Promise<Config> {
  let value: unknown;
  try { value = parse(await readFile(path, 'utf8')); }
  catch (error) { throw new Error(`Cannot read/parse config ${path}: ${String(error)}`); }
  const result = configSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map(i => `${i.path.join('.') || 'config'}: ${i.message}`).join('; '));
  return result.data;
}
