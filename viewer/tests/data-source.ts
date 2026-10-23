import { fileURLToPath } from 'node:url';
export const privateMode = process.env.AEL_FIXTURE_MODE === 'private';
if (process.env.AEL_FIXTURE_MODE && !['private', 'public'].includes(process.env.AEL_FIXTURE_MODE)) {
  throw new Error('Unknown fixture mode');
}
export const dataModeLabel = privateMode ? 'PRIVATE actual-run snapshots' : 'PUBLIC examples / SYNTHETIC scenarios';
export const manifestFile = privateMode ? 'real/manifest.private.json' : 'manifest.json';

/** No existence-based fallback: missing private evidence is an error, never synthetic success. */
export function fixturePath(name: string): string {
  let path = name;
  if (name.startsWith('scenario/')) {
    path = privateMode ? name.replace('scenario/', 'real/mini-lang-') : name.replace('scenario/', 'synthetic/scenario-');
  } else if (name.startsWith('official/') && privateMode) path = name.replace('official/', 'real/example-');
  if (!privateMode && path.startsWith('real/')) throw new Error('Public tests cannot read private fixtures');
  if (!/^(real|synthetic|official)\/[a-z0-9.-]+\.json$/.test(path) && path !== 'manifest.json') throw new Error('Invalid fixture path');
  return fileURLToPath(new URL('./fixtures/'+path, import.meta.url));
}
