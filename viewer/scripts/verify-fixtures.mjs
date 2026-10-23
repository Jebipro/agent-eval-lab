import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import validate from '../src/generated/validate.js';
const directory = new URL('../tests/fixtures/', import.meta.url);
const samples = JSON.parse(await readFile(new URL('../samples/manifest.json', import.meta.url), 'utf8'));
const approvedSamples = new Set(samples.entries.filter(e => samples.publicSampleApproved && e.approval === 'approved-by-user').map(e => e.source.replace('tests/fixtures/', '')));
const privateMode = process.argv.includes('--private');
assert(process.argv.slice(2).every(arg => arg === '--private'), 'Unknown fixture verification option');
const manifestName = privateMode ? 'real/manifest.private.json' : 'manifest.json';
const manifest = JSON.parse(await requiredFile(new URL(manifestName, directory), manifestName));
if (!privateMode) assert.equal(manifest.hashPolicy, 'sha256-utf8-lf');
// Public Git checkouts can use LF or CRLF. Private evidence retains byte-exact hashes.
const hash = bytes => createHash('sha256').update(privateMode ? bytes : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))).digest('hex');
async function requiredFile(url, name) {
  try { return await readFile(url); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`Required ${privateMode ? 'private local' : 'public'} test input missing: ${name}. Restore the matching fixture/source set. No skipping, regeneration or fallback is performed.`);
  }
}
for (const item of manifest.entries) {
  assert((privateMode ? /^(real|synthetic)\/[a-z0-9-]+\.json$/ : /^(official|synthetic)\/[a-z0-9-]+\.json$/).test(item.file));
  if (!privateMode) {
    assert.equal(item.publicRepositoryEligible, true);
    assert(['published-official-example', 'synthetic-contract-test'].includes(item.provenance));
    if (item.provenance === 'synthetic-contract-test') assert.equal(item.source, undefined);
    else assert(/^examples\/reports\/[a-z0-9-]+\.json$/.test(item.source));
  }
  const bytes = await requiredFile(new URL(item.file, directory), item.file);
  assert.equal(hash(bytes), item.sha256, item.file);
  if (item.source) {
    const original = await requiredFile(new URL('../../' + item.source, import.meta.url), item.source);
    assert.equal(hash(original), item.sourceSha256, item.file);
  }
  const text = bytes.toString('utf8');const report = JSON.parse(text);
  assert(validate(report), item.file + ': schema failure');
  assert.deepEqual({ status: report.status, score: report.score, pass: report.summary.pass, total: report.summary.total }, item.expected);
  assert.equal(item.publicSampleApproved, !privateMode && approvedSamples.has(item.file));
  assert(!/[A-Za-z]:[\\/]Users[\\/]|\/Users\/|\/home\/|\b(?:npm_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), item.file + ': sensitive pattern');
}
assert.equal(manifest.entries.length, 15);
console.log(`Verified ${manifest.entries.length} ${privateMode ? 'PRIVATE LOCAL' : 'PUBLIC'} fixtures, source hashes, schema and sensitive-pattern scan; sample approval checked separately from test provenance`);
