// Explicit public test-data preparation only. Never reads private reports.
// Not an install/build/test hook; checked-in snapshots are verified, not silently repaired.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = new URL('../tests/fixtures/', import.meta.url);
const root = new URL('../../', import.meta.url);
const lfBytes = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
const hash = bytes => createHash('sha256').update(lfBytes(bytes)).digest('hex');
const samples = JSON.parse(await readFile(new URL('../samples/manifest.json', import.meta.url), 'utf8'));
const approvedSamples = new Set(samples.entries.filter(e => samples.publicSampleApproved && e.approval === 'approved-by-user').map(e => e.source.replace('tests/fixtures/', '')));
const entries = [];
await mkdir(new URL('official/', directory), { recursive: true });
await mkdir(new URL('synthetic/', directory), { recursive: true });
function entry(file, bytes, provenance, extra = {}) {
  const report = JSON.parse(bytes);
  entries.push({ file, provenance, sha256: hash(bytes), publicRepositoryEligible: true,
    publicSampleApproved: approvedSamples.has(file), ...extra,
    expected: { status: report.status, score: report.score, pass: report.summary.pass, total: report.summary.total } });
}
for (const name of ['success-no-git', 'test-failure', 'type-error', 'execution-error', 'timeout', 'forbidden-file', 'requirements']) {
  const source = `examples/reports/${name}.json`;
  const bytes = lfBytes(await readFile(new URL(source, root)));
  const file = `official/${name}.json`;
  await writeFile(new URL(file, directory), bytes);
  entry(file, bytes, 'published-official-example', { source, sourceSha256: hash(bytes),
    review: 'Already published official example; only physical CRLF line endings normalized to LF. Not a new execution.' });
}
const time = '2026-01-01T00:00:00.000Z';
const command = id => ({
  id, label: `Synthetic ${id}`, kind: 'command', required: true, status: 'pass',
  durationMs: 0, exitCode: 0, reason: null, command: 'npm', args: ['run', id],
  timedOut: false, signal: null, stdout: 'SYNTHETIC: no command was executed.', stderr: '', outputTruncated: false
});
for (const [index, name] of ['normal', 'test-failure', 'forbidden-change', 'restored'].entries()) {
  // Authored from the documented contract, not cloned from a mini-lang report.
  const report = {
    schemaVersion: 1, tool: { name: 'agent-eval-lab', version: '0.1.0' },
    run: { id: `00000000-0000-4000-8000-00000000000${index+1}`, startedAt: time, endedAt: time, durationMs: 0 },
    project: { name: `SYNTHETIC scenario ${name} — not an actual run` },
    status: 'passed', exitCode: 0, score: 100, scoreComplete: true,
    summary: { pass: 3, fail: 0, error: 0, skipped: 0, required: 3, optional: 0, total: 3, optionalFailures: 0 },
    checks: ['tests', 'typecheck', 'explicit-any'].map(command),
    git: {
      enabled: true, baseRef: 'HEAD', baseSha: '0'.repeat(40), capturedAt: time, timing: 'before-commands',
      changes: [{ path: 'agent-eval.yaml', oldPath: null, status: '??', additions: null, deletions: null, binary: false }],
      stats: { files: 1, additions: 0, deletions: 0, incomplete: true }
    },
    warnings: [], errors: []
  };
  if (name === 'test-failure') {
    Object.assign(report, { status: 'failed', exitCode: 1, score: 67 });
    Object.assign(report.summary, { pass: 2, fail: 1 });
    Object.assign(report.checks[0], { status: 'fail', exitCode: 1,
      reason: 'Synthetic test failure', stderr: 'SYNTHETIC_EXPECTED_FAILURE: no real test log.' });
    report.git.changes.push({ path: 'tests/example.test.ts', oldPath: null, status: 'M', additions: 1, deletions: 1, binary: false });
    Object.assign(report.git.stats, { files: 2, additions: 1, deletions: 1 });
  }
  if (name === 'forbidden-change' || name === 'restored') {
    const violated = name === 'forbidden-change';
    report.checks.push({ id: 'forbidden-files', label: 'Synthetic forbidden files', kind: 'forbidden',
      required: true, status: violated ? 'fail' : 'pass', durationMs: 0, exitCode: null,
      reason: violated ? 'Synthetic forbidden path violation' : null,
      violations: violated ? [{ path: 'package.json', pattern: 'package.json' }] : [] });
    Object.assign(report.summary, { pass: violated ? 3 : 4, fail: violated ? 1 : 0, required: 4, total: 4 });
    if (violated) {
      Object.assign(report, { status: 'failed', exitCode: 1, score: 75 });
      report.git.changes.push({ path: 'package.json', oldPath: null, status: 'M', additions: 2, deletions: 1, binary: false });
      Object.assign(report.git.stats, { files: 2, additions: 2, deletions: 1 });
    }
  }
  const file = `synthetic/scenario-${name}.json`, bytes = Buffer.from(JSON.stringify(report, null, 2)+'\n');
  await writeFile(new URL(file, directory), bytes);
  entry(file, bytes, 'synthetic-contract-test', {
    review: 'Hand-authored semantic counterpart; no private report, UUID, timestamp, SHA or log was copied. Not a mini-lang execution.'
  });
}
// Four existing synthetic snapshots are preserved rather than regenerated.
for (const name of ['setup-error', 'cancelled', 'optional-failure', 'truncated-log']) {
  const file = `synthetic/${name}.json`, bytes = await readFile(new URL(file, directory));
  entry(file, bytes, 'synthetic-contract-test', { review: 'Existing synthetic contract test. Not an actual CLI execution.' });
}
await writeFile(new URL('manifest.json', directory), JSON.stringify({
  purpose: 'Public repository test data, not a public Viewer sample catalog',
  hashPolicy: 'sha256-utf8-lf', entries
}, null, 2)+'\n');
console.log(`Prepared ${entries.length} public fixtures: 7 published examples + 8 synthetic; no private inputs read.`);
