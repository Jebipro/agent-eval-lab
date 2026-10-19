import { mkdtemp, writeFile, mkdir, rm, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import spawn from 'cross-spawn';
import { stringify } from 'yaml';
export const repo = resolve('.');
export async function temp() { return mkdtemp(join(tmpdir(), 'agent-eval 한글 space-')); }
export async function write(root: string, path: string, content: string) { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), content); }
export async function config(root: string, checks: unknown[] = [{ id: 'ok', kind: 'command', command: process.execPath, args: ['-e', 'console.log("child output")'] }], extra = {}) { await write(root, 'agent-eval.yaml', stringify({ version: 1, checks, ...extra })); }
export function command(id: string, script: string, extra = {}) { return { id, kind: 'command', command: process.execPath, args: ['-e', script], ...extra }; }
export async function run(executable: string, args: string[], cwd: string, env = process.env) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout!.on('data', d => stdout += d); child.stderr!.on('data', d => stderr += d);
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
export const cli = (root: string, args: string[]) => run(process.execPath, [join(repo, 'dist/cli/index.js'), ...args], root);
export async function git(root: string, ...args: string[]) { const r = await run('git', args, root); if (r.code) throw new Error(r.stderr); return r.stdout.trim(); }
export async function baseline(root: string) { await git(root, 'init'); await git(root, 'add', '.'); await git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'baseline'); }
export async function fixture() { const root = await temp(); await cp(join(repo, 'fixtures/small-project'), root, { recursive: true }); await symlink(join(repo, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir'); return root; }
export async function clean(root: string) { await rm(root, { recursive: true, force: true, maxRetries: 3 }); }
