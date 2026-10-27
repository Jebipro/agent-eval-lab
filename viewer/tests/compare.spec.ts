import { expect, test } from 'vitest';
import { compareReports } from '../src/report/compare';
import type { Report } from '../src/report/types';
import { fixture } from './helpers';
import { parseBytes } from '../src/import/parse';
import { bytes } from './helpers';
const pair = (): [Report, Report] => { const a = fixture('official/success-no-git.json'); return [a, structuredClone(a)]; };
function freeze(value: unknown): void { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } }

test('identical recorded definition and raw values; no quality judgment', () => {
  const [a,b]=pair(); const c=compareReports(a,b);
  expect(c.checks.map(r=>r.type)).toEqual(['status-unchanged','status-unchanged']);
  expect(c.score).toMatchObject({before:100,after:100,rawDelta:0,basis:'recorded-comparable',qualityJudgment:'not-assessed'});
  expect(c.before).toBe(a);expect(c.after).toBe(b);expect(c.git.before).toBe(a.git);
});
for(const from of ['pass','fail','error','skipped'] as const) for(const to of ['pass','fail','error','skipped'] as const) {
  test(`status ${from} to ${to}`,()=>{const[a,b]=pair();a.checks[0]!.status=from;b.checks[0]!.status=to;
    expect(compareReports(a,b).checks[0]!.type).toBe(from===to?'status-unchanged':'status-changed');});
}
test('add/remove keep source order and no positional matching',()=>{
  const[a,b]=pair();b.checks=[{...b.checks[1]!,id:'new'},b.checks[1]!];const c=compareReports(a,b);
  expect(c.checks.map(r=>[r.id,r.type])).toEqual([[a.checks[0]!.id,'before-only'],[a.checks[1]!.id,'status-unchanged'],['new','after-only']]);
  expect(c.score.restrictions).toContain('membership-changed');
});
test.each(['before','after','both','before-only','after-only'] as const)('duplicate %s never pairs arbitrarily',side=>{
  const[a,b]=pair(); if(side==='before'||side==='both'||side==='before-only')a.checks.push(structuredClone(a.checks[0]!));
  if(side==='after'||side==='both'||side==='after-only')b.checks.push(structuredClone(b.checks[0]!));
  if(side==='before-only')b.checks=[];if(side==='after-only')a.checks=[];
  const r=compareReports(a,b).checks.find(r=>r.id==='tests')!;expect(r.type).toBe('incomparable');
  if(r.type==='incomparable'){expect(r.reasons).toContainEqual({code:'duplicate-id'});expect(r.before.length+r.after.length).toBe(a.checks.filter(c=>c.id==='tests').length+b.checks.filter(c=>c.id==='tests').length);}
});
test('order change keeps ID pairing, original indices and restricts scores',()=>{
  const[a,b]=pair();b.checks.reverse();const c=compareReports(a,b);expect(c.orderChanged).toBe(true);expect(c.score.restrictions).toContain('order-changed');
  const r=c.checks[0]!;if(r.type!=='status-unchanged')throw Error('Expected paired row');expect(r.before.index).toBe(0);expect(r.after.index).toBe(1);
});
test.each(['label','kind','required','command','args'] as const)('definition field %s change blocks status pairing',field=>{
  const[a,b]=pair();const c=b.checks[0]!;
  if(field==='label')c.label+=' changed';if(field==='kind')c.kind='forbidden';if(field==='required')c.required=!c.required;if(field==='command')c.command='other';if(field==='args')c.args=['different'];
  const r=compareReports(a,b).checks[0]!;expect(r.type).toBe('incomparable');if(r.type==='incomparable')expect(r.reasons).toContainEqual({code:'definition-changed',fields:[field]});
});
test.each(['command','args'] as const)('missing %s on either or both sides is unknown',field=>{
  const[a,b]=pair();delete a.checks[0]![field];expect(parseBytes(bytes(a)).ok).toBe(true);
  expect(compareReports(a,b).checks[0]!.type).toBe('incomparable');delete b.checks[0]![field];const r=compareReports(a,b).checks[0]!;
  if(r.type!=='incomparable')throw Error('Missing definition must not compare');expect(r.reasons).toContainEqual({code:'command-definition-missing',fields:[field]});
});
test('explicit empty args differs from missing; arg order and whitespace matter',()=>{
  const[a,b]=pair();a.checks[0]!.args=[];b.checks[0]!.args=[];expect(compareReports(a,b).checks[0]!.type).toBe('status-unchanged');
  delete b.checks[0]!.args;expect(compareReports(a,b).checks[0]!.type).toBe('incomparable');
  a.checks[0]!.args=['a','b'];b.checks[0]!.args=['b','a'];expect(compareReports(a,b).checks[0]!.type).toBe('incomparable');
  b.checks[0]!.args=['a','b '];expect(compareReports(a,b).checks[0]!.type).toBe('incomparable');
});
test('empty command is unknown even if equal',()=>{const[a,b]=pair();a.checks[0]!.command=b.checks[0]!.command='';expect(compareReports(a,b).checks[0]!.type).toBe('incomparable');});
test('forbidden violations do not encode complete configured patterns',()=>{
  const a=fixture('official/forbidden-file.json'),b=structuredClone(a);const c=compareReports(a,b);const r=c.checks.find(r=>r.id==='forbidden-files')!;
  expect(r.type).toBe('incomparable');if(r.type==='incomparable')expect(r.reasons).toContainEqual({code:'forbidden-definition-unavailable'});
  expect(c.score.basis).toBe('not-comparable');
});
test('execution output fields are preserved, not treated as definition',()=>{
  const[a,b]=pair();const c=b.checks[0]!;c.durationMs=999;c.exitCode=null;c.reason='changed';c.stdout='<img>';delete c.stderr;c.signal=null;c.timedOut=true;c.outputTruncated=true;
  expect(compareReports(a,b).checks[0]!.type).toBe('status-unchanged');expect(compareReports(a,b).after.checks[0]).toBe(c);
});
test.each(['null','incomplete','changed'] as const)('score %s remains raw and never ranked',mode=>{
  const[a,b]=pair();b.score=0;if(mode==='null')a.score=null;if(mode==='incomplete')b.scoreComplete=false;if(mode==='changed')b.checks[0]!.required=false;
  const c=compareReports(a,b);expect(c.score.before).toBe(a.score);expect(c.score.after).toBe(0);expect(c.score.rawDelta).toBe(mode==='null'?null:-100);expect(c.score.basis).toBe('not-comparable');expect(c.score.qualityJudgment).toBe('not-assessed');
});
test('different run IDs and reversed timestamps never cause reorder or identity inference',()=>{
  const[a,b]=pair();b.run.id='00000000-0000-4000-8000-000000000012';b.run.startedAt='2020-01-01T00:00:00.000Z';const c=compareReports(a,b);expect(c.before.run).toBe(a.run);expect(c.after.run).toBe(b.run);expect(c.checks[0]!.type).toBe('status-unchanged');
});
test.each(['project','tool'] as const)('different %s metadata prevents assumed pairing',field=>{
  const[a,b]=pair();if(field==='project')b.project.name='other';else b.tool.version='9.0.0';const c=compareReports(a,b);expect(c.checks.every(r=>r.type==='incomparable')).toBe(true);expect(c.score.restrictions).toContain('context-different');
});
test('Git null, disabled, enabled and incomplete remain independent snapshots',()=>{
  const[a,b]=pair();a.git=null;expect(compareReports(a,b).git).toEqual({kind:'independent-snapshots',before:null,after:b.git});
  b.git=fixture('official/forbidden-file.json').git;b.git!.stats.incomplete=true;const c=compareReports(a,b);expect(c.git.after).toBe(b.git);expect(c.git.after!.capturedAt).toBe(b.git!.capturedAt);expect(c.git.after!.timing).toBe('before-commands');
});
test('empty reports, hostile ID strings and exact ID case',()=>{
  const[a,b]=pair();a.checks=[];b.checks=[];expect(compareReports(a,b).score.restrictions).toContain('no-checks');
  const seed=fixture().checks[0]!;a.checks=['__proto__','constructor','ID','id',''].map(id=>({...seed,id}));b.checks=structuredClone(a.checks);expect(compareReports(a,b).checks.map(r=>r.id)).toEqual(a.checks.map(c=>c.id));
});
test('deterministic generated invariants: frozen originals, all indices once, reverse symmetry',()=>{
  let seed=12345;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let trial=0;trial<40;trial++){
    const[a,b]=pair();const base=a.checks[0]!;
    for(const r of [a,b])r.checks=Array.from({length:rand()%30},()=>({...base,id:String(rand()%12),required:rand()%2===0,status:(['pass','fail','error','skipped'] as const)[rand()%4]!}));
    const oldA=JSON.stringify(a),oldB=JSON.stringify(b);freeze(a);freeze(b);
    const c=compareReports(a,b);expect(compareReports(a,b)).toEqual(c);expect(JSON.stringify(a)).toBe(oldA);expect(JSON.stringify(b)).toBe(oldB);
    const before:number[]=[],after:number[]=[];for(const row of c.checks){if(row.type==='incomparable'){before.push(...row.before.map(x=>x.index));after.push(...row.after.map(x=>x.index));}else{if('before'in row)before.push(row.before.index);if('after'in row)after.push(row.after.index);}}
    expect(before.sort((x,y)=>x-y)).toEqual(a.checks.map((_,i)=>i));expect(after.sort((x,y)=>x-y)).toEqual(b.checks.map((_,i)=>i));
    expect(compareReports(b,a).score.rawDelta! + c.score.rawDelta!).toBe(0);
  }
});
