import { afterEach, expect, test } from 'vitest';
import { rename, unlink, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { snapshot, violations } from '../../src/git/snapshot.js';
import { temp, clean, write, git, baseline } from '../helpers.js';
const roots: string[] = []; afterEach(async () => { for (const r of roots.splice(0)) await clean(r); });
async function setup() { const r = await temp(); roots.push(r); await write(r, '.gitignore', 'node_modules/\n.agent-eval/\nignored.env\n'); await write(r, 'tracked.txt', 'one\ntwo\n'); await baseline(r); return r; }
test('final working tree combines staged, unstaged, untracked and excludes outputs', async () => {
  const r = await setup(); await write(r, 'tracked.txt', 'one\nthree\n'); await git(r, 'add', 'tracked.txt'); await write(r, 'tracked.txt', 'one\nfour\nfive\n'); await write(r, '한글 space.txt', 'new'); await write(r, 'ignored.env', 'hidden'); await write(r, 'node_modules/a', 'x'); await write(r, '.agent-eval/report.json', '{}'); await write(r, 'custom.json', '{}');
  const s = await snapshot(r, 'HEAD', join(r, 'custom.json')); expect(s.changes.map(c => c.path).sort()).toEqual(['tracked.txt', '한글 space.txt'].sort()); expect(s.stats).toMatchObject({ files: 2, additions: 2, deletions: 1, incomplete: true });
  await write(r, 'tracked.txt', 'one\ntwo\n'); expect((await snapshot(r, 'HEAD', join(r, 'custom.json'))).changes.some(c => c.path === 'tracked.txt')).toBe(false);
});
test('rename old/new, deleted, binary and dotfile matching', async () => {
  const r = await setup(); await write(r, '.env.example', 'example\n'); await write(r, 'delete.txt', 'gone\n'); await writeFile(join(r, 'binary.dat'), Buffer.from([0, 1, 2])); await git(r, 'add', '.'); await git(r, '-c', 'user.name=Fixture', '-c', 'user.email=f@invalid', 'commit', '-m', 'more');
  await rename(join(r, '.env.example'), join(r, 'safe.txt')); await git(r, 'add', '-A'); await unlink(join(r, 'delete.txt')); await writeFile(join(r, 'binary.dat'), Buffer.from([0, 3, 4]));
  const s = await snapshot(r, 'HEAD', join(r, '.agent-eval/report.json')); const renamed = s.changes.find(c => c.oldPath); expect(renamed).toMatchObject({ oldPath: '.env.example', path: 'safe.txt' }); expect(s.changes.find(c => c.path === 'binary.dat')?.additions).toBeNull(); expect(s.changes.find(c => c.path === 'delete.txt')?.status).toBe('D');
  expect(violations(s.changes, ['**/.env.*', 'safe.txt', 'delete.txt'])).toHaveLength(3); expect(violations(s.changes, ['untouched/**'])).toEqual([]);
});
test('different base, invalid base and nested project scope', async () => {
  const r = await setup(); const sha = await git(r, 'rev-parse', 'HEAD'); await write(r, 'nested/file.txt', 'first\n'); await write(r, 'sibling/file.txt', 'first\n'); await git(r, 'add', '.'); await git(r, '-c', 'user.name=Fixture', '-c', 'user.email=f@invalid', 'commit', '-m', 'second');
  await write(r, 'nested/file.txt', 'changed\n'); await write(r, 'sibling/file.txt', 'changed\n'); const nested = join(r, 'nested'); const s = await snapshot(nested, 'HEAD', join(nested, '.agent-eval/report.json')); expect(s.changes.map(c => c.path)).toEqual(['file.txt']); expect((await snapshot(r, sha, join(r, 'out.json'))).baseSha).toBe(sha); await expect(snapshot(r, 'not-a-valid-ref', join(r, 'out.json'))).rejects.toThrow();
});
test.skipIf(process.platform === 'win32')('tab filename uses NUL-delimited Git parsing', async () => { const r = await setup(); await write(r, 'tab\tname.txt', 'old\n'); await git(r, 'add', '.'); await git(r, '-c', 'user.name=Fixture', '-c', 'user.email=f@invalid', 'commit', '-m', 'tab'); await write(r, 'tab\tname.txt', 'new\n'); expect((await snapshot(r, 'HEAD', join(r, 'out.json'))).changes[0]?.path).toBe('tab\tname.txt'); });
test('Git absent repository rejects enabled analysis', async () => { const r = await temp(); roots.push(r); await expect(snapshot(r, 'HEAD', join(r, 'out.json'))).rejects.toThrow(); });
test('staged removal restored in working tree counts final content once', async () => { const r = await setup(); await git(r, 'rm', '--cached', 'tracked.txt'); const restored = await snapshot(r, 'HEAD', join(r, 'out.json')); expect(restored.changes).toEqual([]); await write(r, 'tracked.txt', 'one\nchanged\n'); const edited = await snapshot(r, 'HEAD', join(r, 'out.json')); expect(edited.changes).toHaveLength(1); expect(edited.changes[0]).toMatchObject({ path: 'tracked.txt', additions: 1, deletions: 1 }); });
test('staged rename with original restored is a final addition, not two changes', async () => { const r = await setup(); await git(r, 'mv', 'tracked.txt', 'renamed.txt'); await write(r, 'tracked.txt', 'one\ntwo\n'); const s = await snapshot(r, 'HEAD', join(r, 'out.json')); expect(s.changes).toEqual([{ path: 'renamed.txt', oldPath: null, status: 'A', additions: 2, deletions: 0, binary: false }]); expect(violations(s.changes, ['tracked.txt'])).toEqual([]); });
