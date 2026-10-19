import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { relative, resolve } from 'node:path';
import { mkdtemp, writeFile, readFile, readlink, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { minimatch } from 'minimatch';
import { createHash } from 'node:crypto';
import type { GitChange, GitSnapshot } from '../report/types.js';

const exec = promisify(execFile);
export async function git(cwd: string, args: string[]): Promise<string> {
  const result = await exec('git', ['--no-optional-locks', ...args], { cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } });
  return result.stdout;
}
export async function resolveBase(cwd: string, base: string): Promise<string> {
  return (await git(cwd, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`])).trim();
}
// A path removed from the index but restored on disk appears as both D and
// untracked to Git. Compare its final bytes without changing the user's index.
async function compareFinalContent(cwd: string, baseSha: string | null, path: string): Promise<GitChange | null> {
  const prefix = (await git(cwd, ['rev-parse', '--show-prefix'])).replace(/\r?\n$/, '');
  const before = baseSha ? (await exec('git', ['cat-file', 'blob', `${baseSha}:${prefix}${path}`], { cwd, encoding: 'buffer', timeout: 15000, maxBuffer: 16 * 1024 * 1024, windowsHide: true })).stdout : Buffer.alloc(0);
  const current = join(cwd, path); const info = await lstat(current);
  if (info.size > 16 * 1024 * 1024) throw new Error(`Restored path exceeds the 16 MiB comparison limit: ${path}`);
  let after = info.isSymbolicLink() ? Buffer.from(await readlink(current)) : await readFile(current);
  if (!info.isSymbolicLink()) {
    // Let Git decide the clean representation without writing an index or object.
    // Do not execute project clean filters during this exceptional comparison.
    const attributes = (await git(cwd, ['check-attr', '-z', 'filter', 'working-tree-encoding', 'text', 'eol', '--', path])).split('\0');
    const values = new Map<string, string>();
    for (let i = 0; i + 2 < attributes.length; i += 3) {
      const name = attributes[i + 1]!, value = attributes[i + 2]!; values.set(name, value);
      if (['filter', 'working-tree-encoding'].includes(name) && !['unspecified', 'unset'].includes(value)) throw new Error(`Cannot safely normalize restored path ${JSON.stringify(path)} with ${name}=${value}`);
    }
    const top = (await git(cwd, ['rev-parse', '--show-toplevel'])).replace(/\r?\n$/, '');
    const normalizedHash = (await git(top, ['hash-object', `--path=${prefix}${path}`, '--', current])).trim();
    const hash = (data: Buffer) => createHash(normalizedHash.length === 64 ? 'sha256' : 'sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
    if (hash(after) !== normalizedHash) {
      // Byte-preserving CRLF conversion, including non-UTF-8 files. Verify the
      // candidate against Git rather than approximating attributes/autocrlf rules.
      const lf = Buffer.from(after.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
      if (hash(lf) !== normalizedHash) throw new Error(`Unsupported Git normalization for restored path ${JSON.stringify(path)}`);
      // Auto text conversion preserves a pre-existing CRLF index blob. The
      // restored entry is absent from the index, so retain that base semantics.
      const automatic = values.get('text') === 'auto' || (values.get('text') === 'unspecified' && values.get('eol') === 'unspecified');
      if (!(automatic && before.includes(Buffer.from('\r\n')))) after = lf;
    }
  }
  if (before.equals(after)) return baseSha ? null : { path, oldPath: null, status: 'A', additions: 0, deletions: 0, binary: false };
  const temporary = await mkdtemp(join(tmpdir(), 'agent-eval-diff-'));
  try {
    await writeFile(join(temporary, 'before'), before); await writeFile(join(temporary, 'after'), after);
    let output: string;
    try { output = await git(temporary, ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-ext-diff', '--no-textconv', '--numstat', '-z', '--', 'before', 'after']); }
    catch (error) { const failure = error as { code?: number; stdout?: string }; if (failure.code !== 1 || typeof failure.stdout !== 'string') throw error; output = failure.stdout; }
    if (!output) return null;
    const [added, removed] = output.split('\t');
    if (!added || !removed) throw new Error('Unrecognized restored-path numstat record');
    return { path, oldPath: null, status: baseSha ? 'M' : 'A', additions: added === '-' ? null : Number(added), deletions: removed === '-' ? null : Number(removed), binary: added === '-' };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
export async function snapshot(cwd: string, base: string, reportPath: string): Promise<GitSnapshot> {
  const capturedAt = new Date().toISOString();
  const baseSha = await resolveBase(cwd, base);
  const reportRelative = relative(cwd, resolve(reportPath)).replaceAll('\\', '/');
  const included = (path: string) => !path.startsWith('../') && !path.split('/').some(p => ['.git', 'node_modules', '.agent-eval'].includes(p)) && (process.platform === 'win32' ? path.toLowerCase() !== reportRelative.toLowerCase() : path !== reportRelative);
  const flagged = (await git(cwd, ['ls-files', '-v', '-z', '--', '.'])).split('\0').filter(record => record && included(record.slice(2)) && (record[0] === 'S' || record[0] === record[0]!.toLowerCase()));
  if (flagged.length) throw new Error(`Unsupported Git index flags (assume-unchanged/skip-worktree): ${flagged.slice(0, 8).map(record => JSON.stringify(record.slice(2))).join(', ')}. Review these flags before evaluating; the index was not modified.`);
  const args = ['diff', '--no-ext-diff', '--no-textconv', '--relative', '--find-renames', '-z'];
  const names = (await git(cwd, [...args, '--name-status', baseSha, '--', '.'])).split('\0');
  const nums = (await git(cwd, [...args, '--numstat', baseSha, '--', '.'])).split('\0');
  const numbers = new Map<string, { additions: number | null; deletions: number | null; binary: boolean }>();
  for (let i = 0; i < nums.length; i++) {
    const item = nums[i]; if (!item) continue;
    const match = /^([^\t]+)\t([^\t]+)\t([\s\S]*)$/.exec(item);
    if (!match) throw new Error('Unrecognized Git numstat record');
    let path = match[3]!;
    if (path === '') { i++; path = nums[++i]!; }
    numbers.set(path, { additions: match[1] === '-' ? null : Number(match[1]), deletions: match[2] === '-' ? null : Number(match[2]), binary: match[1] === '-' });
  }
  const changes: GitChange[] = [];
  for (let i = 0; i < names.length;) {
    const status = names[i++]; if (!status) continue;
    let path = names[i++]!; let oldPath: string | null = null;
    if (status.startsWith('R') || status.startsWith('C')) { oldPath = path; path = names[i++]!; }
    if (!included(path) && !(oldPath && included(oldPath))) continue;
    changes.push({ path, oldPath, status, ...(numbers.get(path) ?? { additions: null, deletions: null, binary: false }) });
  }
  const untracked = (await git(cwd, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.'])).split('\0');
  for (const path of untracked) if (path && included(path)) {
    const deleted = changes.findIndex(c => (c.path === path && c.status === 'D') || (c.oldPath === path && c.status.startsWith('R')));
    if (deleted >= 0) {
      const previous = changes.splice(deleted, 1)[0]!;
      if (previous.oldPath && included(previous.path)) { const addition = await compareFinalContent(cwd, null, previous.path); if (addition) changes.push(addition); }
      const restored = await compareFinalContent(cwd, baseSha, path); if (restored) changes.push(restored);
    }
    else changes.push({ path, oldPath: null, status: 'untracked', additions: null, deletions: null, binary: false });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return { enabled: true, baseRef: base, baseSha, capturedAt, timing: 'before-commands', changes,
    stats: { files: changes.length, additions: changes.reduce((n, c) => n + (c.additions ?? 0), 0), deletions: changes.reduce((n, c) => n + (c.deletions ?? 0), 0), incomplete: changes.some(c => c.additions === null || c.deletions === null) } };
}
export function violations(changes: GitChange[], patterns: string[]): { path: string; pattern: string }[] {
  const found = new Map<string, { path: string; pattern: string }>();
  for (const change of changes) for (const path of [change.path, change.oldPath]) if (path) for (const pattern of patterns) {
    if (minimatch(path, pattern, { dot: true, nonegate: true, nocomment: true, noext: true })) found.set(JSON.stringify([path, pattern]), { path, pattern });
  }
  return [...found.values()];
}
