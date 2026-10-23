import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import validate from '../src/generated/validate.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('samples/manifest.json', root), 'utf8'));
const fixtures = JSON.parse(await readFile(new URL('tests/fixtures/manifest.json', root), 'utf8'));
assert.equal(manifest.publicSampleApproved, true);
assert.equal(manifest.hashPolicy, 'sha256-utf8-lf');
assert.equal(manifest.entries.length, 7);
const payloads = Object.create(null);
for (const item of manifest.entries) {
  assert(/^[a-z]+$/.test(item.id) && !Object.hasOwn(payloads, item.id));
  assert(/^tests\/fixtures\/(official|synthetic)\/[a-z-]+\.json$/.test(item.source));
  assert.equal(item.approval, 'approved-by-user');
  assert(['official', 'synthetic'].includes(item.kind));
  assert(item.review.date && item.review.scope && item.review.result && item.review.anonymization);
  const original = fixtures.entries.find(e => 'tests/fixtures/' + e.file === item.source);
  assert(original?.publicRepositoryEligible && original.publicSampleApproved);
  assert.equal(item.kind, original.provenance === 'published-official-example' ? 'official' : 'synthetic');
  assert.equal(item.publishedSource, original.source ?? null);
  const text = (await readFile(new URL(item.source, root), 'utf8')).replace(/\r\n/g, '\n');
  const sha = createHash('sha256').update(text).digest('hex');
  assert.equal(sha, item.sha256); assert.equal(sha, original.sha256);
  const report = JSON.parse(text);
  assert(validate(report), item.id + ': schema failure');
  assert.deepEqual({status: report.status, score: report.score, pass: report.summary.pass, total: report.summary.total}, item.expected);
  const decoded = JSON.stringify(report).replace(/\\\\/g, '/');
  assert(!/[A-Za-z]:[\\/]Users[\\/]|\/(?:Users|home)\/|\b(?:npm_|ghp_|github_pat_)[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(decoded));
  payloads[item.id] = text;
}
await mkdir(new URL('src/generated/', root), { recursive: true });
await writeFile(new URL('src/generated/example-data.ts', root),
  '// Generated from the user-approved example allowlist. Never import private fixtures.\n' +
  'export const payloads: Readonly<Record<string, string>> = ' + JSON.stringify(payloads) + ';\n');
console.log('Verified and generated 7 user-approved public examples');
