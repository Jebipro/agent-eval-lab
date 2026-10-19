import { lstat, readFile, mkdir, writeFile, rename, unlink, realpath } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Report } from './types.js';
import { serialize } from './serialize.js';
import { reportSchema } from './schema.js';

export async function validateReportPath(path: string, configPath: string): Promise<void> {
  if (resolve(path).toLowerCase() === resolve(configPath).toLowerCase() || extname(path).toLowerCase() !== '.json') throw new Error('Report path must be a .json file, distinct from the configuration.');
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Report target must be a regular file, not a directory or symlink.');
    const existing = JSON.parse(await readFile(path, 'utf8')) as Partial<Report>;
    if (!reportSchema.safeParse(existing).success) throw new Error('Refusing to overwrite a file that is not an Agent Eval Lab report.');
    if (await realpath(path) === await realpath(configPath).catch(() => configPath)) throw new Error('Report target aliases the configuration.');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
export async function saveReport(path: string, report: Report, configPath: string): Promise<void> {
  await validateReportPath(path, configPath);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, serialize(report), { flag: 'wx' }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => undefined); }
}
