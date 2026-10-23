import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseBytes, parseFile } from '../src/import/parse';
import { LIMITS, withinStructureLimits } from '../src/import/limits';
import { schemaHash } from '../src/generated/schema-hash';
import { acceptanceView, displayText } from '../src/report/view-model';
import { fixture, fixtureText, bytes } from './helpers';
import samples from '../samples/manifest.json';
import { privateMode, manifestFile, dataModeLabel } from './data-source';

const manifest = JSON.parse(fixtureText(manifestFile)) as { entries: { file: string; provenance: string; publicSampleApproved: boolean; expected: {status: string;score: number | null;pass: number;total: number} }[] };
test.each(manifest.entries)('canonical contract and exact values: $file', item => {
  const source = JSON.parse(fixtureText(item.file));
  const result = parseBytes(bytes(source));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected valid fixture');
  expect(result.report).toEqual(source);
  expect({status: result.report.status, score: result.report.score, pass: result.report.summary.pass, total: result.report.summary.total}).toEqual(item.expected);
  expect(item.publicSampleApproved).toBe(!privateMode && samples.publicSampleApproved && samples.entries.some(e => e.source === 'tests/fixtures/' + item.file && e.approval === 'approved-by-user'));
});
test('generated schema matches the unchanged canonical JSON Schema bytes', () => {
  const canonical = readFileSync(new URL('../../docs/report.schema.json', import.meta.url));
  expect(schemaHash).toBe(createHash('sha256').update(canonical).digest('hex'));
});
test(`data provenance is explicit: ${dataModeLabel}`, () => {
  expect(manifest.entries.filter(e => e.provenance === (privateMode ? 'actual-run-anonymized' : 'published-official-example'))).toHaveLength(privateMode ? 11 : 7);
  expect(manifest.entries.filter(e => e.provenance === 'synthetic-contract-test')).toHaveLength(privateMode ? 4 : 8);
  const cases = ['normal', 'test-failure', 'forbidden-change', 'restored'].map(n => fixture(`scenario/${n}.json`));
  expect(cases.map(r => [r.summary.pass, r.summary.total, r.score])).toEqual([[3,3,100],[2,3,67],[3,4,75],[4,4,100]]);
});
test.each([
  { name: 'normal', status: 'passed', exit: 0, pass: 3, total: 3, score: 100 },
  { name: 'test-failure', status: 'failed', exit: 1, pass: 2, total: 3, score: 67 },
  { name: 'forbidden-change', status: 'failed', exit: 1, pass: 3, total: 4, score: 75 },
  { name: 'restored', status: 'passed', exit: 0, pass: 4, total: 4, score: 100 }
])('semantic scenario $name preserves score, checks and Git evidence', item => {
  const report = fixture(`scenario/${item.name}.json`);
  expect(parseBytes(bytes(report))).toEqual({ ok: true, report });
  expect(report).toMatchObject({ status: item.status, exitCode: item.exit, score: item.score, scoreComplete: true,
    summary: { pass: item.pass, total: item.total, fail: item.total-item.pass, error: 0, skipped: 0, optional: 0 },
    git: { enabled: true, timing: 'before-commands', stats: { incomplete: true } } });
  expect(report.checks).toHaveLength(item.total);
  expect(report.checks.filter(c => c.status === 'pass')).toHaveLength(item.pass);
  if (!privateMode) expect(report.project.name).toContain('SYNTHETIC');
  const tests = report.checks.find(c => c.id === 'tests')!;
  if (item.name === 'test-failure') {
    expect(tests).toMatchObject({ status: 'fail', exitCode: 1 });
    expect(tests.reason).toBeTruthy(); expect(tests.stderr).toBeTruthy();
    expect(report.git!.changes.some(c => c.status === 'M' && c.additions === 1 && c.deletions === 1)).toBe(true);
  } else expect(tests.status).toBe('pass');
  const gate = report.checks.find(c => c.kind === 'forbidden');
  if (item.total === 4) {
    expect(gate).toMatchObject({ status: item.name === 'restored' ? 'pass' : 'fail', exitCode: null,
      violations: item.name === 'restored' ? [] : [{ path: 'package.json', pattern: 'package.json' }] });
  } else expect(gate).toBeUndefined();
  if (item.name === 'forbidden-change') {
    expect(report.checks.filter(c => c.kind === 'command').every(c => c.status === 'pass')).toBe(true);
    expect(report.git!.changes).toContainEqual({ path: 'package.json', oldPath: null, status: 'M', additions: 2, deletions: 1, binary: false });
  }
  if (item.name === 'normal' || item.name === 'restored') expect(report.git!.changes).toHaveLength(1);
});
test.each(['schemaVersion','tool','run','project','status','exitCode','score','scoreComplete','summary','checks','git','warnings','errors'])('missing required %s is SchemaError', key => {
  const data = fixture() as unknown as Record<string, unknown>; delete data[key];
  expect(parseBytes(bytes(data))).toMatchObject({ok:false,error:{code:'SchemaError'}});
});
test.each([
  ['score','100'],['score',101],['score',-1],['score',1.5],['scoreComplete','true'],
  ['schemaVersion','1'],['exitCode',3],['status','PASS'],['checks',{}],['git',true]
])('wrong type or constraint: %s = %s', (key, value) => {
  const data = fixture() as unknown as Record<string, unknown>;data[String(key)] = value;
  expect(parseBytes(bytes(data))).toMatchObject({ok:false,error:{code:'SchemaError'}});
});
test.each([0,2,-1,1.5])('unsupported numeric schemaVersion %s', version => {
  expect(parseBytes(bytes({...fixture(),schemaVersion:version}))).toMatchObject({ok:false,error:{code:'UnsupportedVersion'}});
});
test.each([null,[],true,42,'text'])('non-object root fails schema: %s', value => {
  expect(parseBytes(bytes(value))).toMatchObject({ok:false,error:{code:'SchemaError'}});
});
test.each(['', '{', '{"secret":"DO_NOT_ECHO",}', '{"a":1} trailing'])('syntax errors never echo input: %s', text => {
  const result = parseBytes(new TextEncoder().encode(text));
  expect(result).toMatchObject({ok:false,error:{code:'ParseError'}});
  expect(JSON.stringify(result)).not.toContain('DO_NOT_ECHO');expect(result).not.toHaveProperty('report');
});
test('strict unknown properties, including prototype-shaped keys, are rejected without pollution', () => {
  const result = parseBytes(new TextEncoder().encode(fixtureText('scenario/normal.json').replace('"schemaVersion": 1', '"__proto__": {"polluted": true}, "schemaVersion": 1')));
  expect(result).toMatchObject({ok:false,error:{code:'SchemaError'}});
  expect(Object.prototype).not.toHaveProperty('polluted');
  expect(parseBytes(bytes({...fixture(),extra:'SECRET_VALUE'}))).toMatchObject({ok:false,error:{code:'SchemaError'}});
  expect(JSON.stringify(parseBytes(bytes({...fixture(),extra:'SECRET_VALUE'})))).not.toContain('SECRET_VALUE');
});
test.each(['id','startedAt','durationMs'])('run format and safe-integer restrictions: %s', key => {
  const report = fixture();
  if (key==='id') report.run.id='not-a-uuid';
  if (key==='startedAt') report.run.startedAt='2026-02-30T00:00:00Z';
  if (key==='durationMs') report.run.durationMs=Number.MAX_SAFE_INTEGER+1;
  expect(parseBytes(bytes(report))).toMatchObject({ok:false,error:{code:'SchemaError'}});
});
test('does not invent semantic constraints or recalculate inconsistent source values', () => {
  const report=fixture();report.score=42;report.status='error';report.exitCode=0;report.summary.total=77;
  report.checks[1]!.id=report.checks[0]!.id;report.project.name='';
  const result=parseBytes(bytes(report));expect(result).toEqual({ok:true,report});
});
test('schema-optional command fields can be absent; original is not defaulted', () => {
  const report=fixture();delete report.checks[0]!.stdout;delete report.checks[0]!.command;
  const result=parseBytes(bytes(report));expect(result).toEqual({ok:true,report});
});
test('null score and Git analysis absence stay distinct from zero and disabled', () => {
  const r=fixture('synthetic/setup-error.json');const result=parseBytes(bytes(r));
  expect(result).toMatchObject({ok:true,report:{score:null,scoreComplete:false,git:null,checks:[]}});
  expect(parseBytes(bytes(fixture('official/success-no-git.json')))).toMatchObject({ok:true,report:{git:{enabled:false}}});
});
test('forbidden result and truncation flag are preserved without fabricated command exit', () => {
  const r=fixture('scenario/forbidden-change.json');const gate=r.checks.find(c=>c.kind==='forbidden');
  expect(gate).toMatchObject({exitCode:null,violations:[{path:'package.json',pattern:'package.json'}]});
  expect(parseBytes(bytes(r))).toEqual({ok:true,report:r});
  expect(parseBytes(bytes(fixture('synthetic/truncated-log.json')))).toMatchObject({ok:true,report:{checks:[{outputTruncated:true},{}]}});
});
test('TypeScript check exit 2 is preserved as fail and overall failed/1', () => {
  const result=parseBytes(bytes(fixture('official/type-error.json')));
  expect(result).toMatchObject({ok:true,report:{status:'failed',exitCode:1,checks:[{}, {status:'fail',exitCode:2}]}});
});
test('malformed UTF-8 is a DecodeError, valid replacement characters remain text', () => {
  expect(parseBytes(new Uint8Array([255]))).toMatchObject({ok:false,error:{code:'DecodeError'}});
  const r=fixture();r.project.name='�';expect(parseBytes(bytes(r))).toEqual({ok:true,report:r});
});
test('one UTF-8 BOM is accepted, two BOMs are not silently stripped', () => {
  const encoded=bytes(fixture());
  expect(parseBytes(new Uint8Array([239,187,191,...encoded])).ok).toBe(true);
  expect(parseBytes(new Uint8Array([239,187,191,239,187,191,...encoded]))).toMatchObject({ok:false,error:{code:'ParseError'}});
});
test('10 MiB exact boundary accepted, larger file rejected before reading', async () => {
  const raw=bytes(fixture());const exact=new Uint8Array(LIMITS.bytes).fill(32);exact.set(raw);
  expect(parseBytes(exact).ok).toBe(true);
  const file=new Blob([new Uint8Array(LIMITS.bytes+1)]);const read=vi.spyOn(file,'arrayBuffer');
  expect(await parseFile(file)).toMatchObject({ok:false,error:{code:'ResourceLimitError'}});expect(read).not.toHaveBeenCalled();
  expect(parseBytes(new Uint8Array(LIMITS.bytes+1))).toMatchObject({ok:false,error:{code:'ResourceLimitError'}});
});
test('Blob read failure never returns or logs native exception contents', async () => {
  const file=new Blob(['x']);vi.spyOn(file,'arrayBuffer').mockRejectedValue(new Error('SECRET_PATH'));
  const result=await parseFile(file);expect(result).toMatchObject({ok:false,error:{code:'ReadError'}});expect(JSON.stringify(result)).not.toContain('SECRET_PATH');
});
describe('resource policy is distinct from canonical schema', () => {
  test('depth boundary 64/65', () => {
    let nested:unknown=0;for(let i=0;i<LIMITS.depth;i++)nested=[nested];
    expect(withinStructureLimits(nested)).toBe(true);expect(withinStructureLimits([nested])).toBe(false);
    expect(parseBytes(bytes([nested]))).toMatchObject({ok:false,error:{code:'ResourceLimitError'}});
  });
  test('node count boundary includes root', () => {
    expect(withinStructureLimits(new Array(LIMITS.nodes-1).fill(0))).toBe(true);
    expect(withinStructureLimits(new Array(LIMITS.nodes).fill(0))).toBe(false);
  });
  test('checks and Git changes bounds', () => {
    expect(withinStructureLimits({checks:new Array(LIMITS.checks).fill(null)})).toBe(true);
    expect(withinStructureLimits({checks:new Array(LIMITS.checks+1).fill(null)})).toBe(false);
    expect(withinStructureLimits({git:{changes:new Array(LIMITS.changes).fill(null)}})).toBe(true);
    expect(withinStructureLimits({git:{changes:new Array(LIMITS.changes+1).fill(null)}})).toBe(false);
  });
});
test('display adapter keeps untrusted text separate and never mutates validated data', () => {
  const r=fixture();r.project.name='<img src=x onerror=alert(1)>\u202e';
  const original=JSON.stringify(r);const result=parseBytes(bytes(r));if(!result.ok)throw new Error('fixture invalid');
  const view=acceptanceView(result.report);expect(view.projectName).toBe('<img src=x onerror=alert(1)>\\u202e');
  expect(JSON.stringify(result.report)).toBe(original);expect(displayText('x'.repeat(1000))).toHaveLength(257);
});
