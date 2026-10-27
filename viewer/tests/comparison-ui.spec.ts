import { test, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparisonView } from '../src/components/ComparisonView';
import { compareReports } from '../src/report/compare';
import { comparisonRows, references, reasonText, scoreReasons } from '../src/report/comparison-view';
import { importReducer, type ImportState } from '../src/app/import-state';
import { fixture } from './helpers';
const pair = () => { const a = fixture('official/success-no-git.json'); return [a, structuredClone(a)] as const; };

test('combined literal comparison filters preserve engine order and objects', () => {
  const [a,b] = pair(); b.checks[0]!.status = 'fail'; b.checks[0]!.label = '한글 [.*] <img>';
  const rows = compareReports(a,b).checks;
  expect(comparisonRows(rows, '[.*]', 'incomparable')).toEqual([rows[0]]);
  expect(comparisonRows(rows, '[.*]', 'status-changed')).toEqual([]);
  expect(comparisonRows(rows, '.*', 'all')).toEqual([rows[0]]);
  expect(comparisonRows(rows, 'missing', 'all')).toEqual([]);
  expect(comparisonRows(rows, '', 'all')).toEqual(rows);
  expect(comparisonRows(rows, '', 'all')[0]).toBe(rows[0]);
});
test('every change type filters independently and empty side stays empty', () => {
  const [a,b] = pair(); a.checks.push({...a.checks[0]!,id:'old'}); b.checks.push({...b.checks[0]!,id:'new'}); b.checks[0]!.status='fail';
  const rows=compareReports(a,b).checks;
  for (const type of ['status-changed','status-unchanged','before-only','after-only']) expect(comparisonRows(rows,'',type)).toHaveLength(1);
  const old=rows.find(r=>r.type==='before-only')!; expect(references(old,'after')).toEqual([]);
});
test('incomparable statuses are separate originals with reasons, not a transition', () => {
  const [a,b]=pair(); b.checks[0]!.status='fail'; b.checks[0]!.required=false;
  const html=renderToStaticMarkup(createElement(ComparisonView,{before:a,after:b}));
  expect(html).toContain('두 상태를 직접적인 상태 변화로 해석하지 마세요.');
  expect(html).toContain('검사 정의 변경: required');
  expect(html).toContain('A 원본 검사'); expect(html).toContain('B 원본 검사');
  expect(html).toContain('통과 (pass)'); expect(html).toContain('실패 (fail)');
});
test('null scores, incomplete scores and independent Git snapshots retain original metadata',()=>{
  const [a,b]=pair();a.score=null;b.scoreComplete=false;a.git=null;
  const html=renderToStaticMarkup(createElement(ComparisonView,{before:a,after:b}));
  expect(html).toContain('점수 없음 (null)');expect(html).toContain('계산 불가 (null)');expect(html).toContain('불완전 (false)');
  expect(html).toContain('Git 분석 결과 없음');expect(html).toContain('Git 검사 비활성');
  expect(html).toContain('comparison-before-git-title'); expect(html).toContain('comparison-after-git-title');
  expect(html).toContain(a.run.id);expect(html).toContain(b.run.startedAt);
});
test('10000 checks only render 100 comparison articles without source changes',()=>{
  const [a,b]=pair();a.checks=Array.from({length:10000},(_,i)=>({...a.checks[0]!,id:String(i)}));b.checks=structuredClone(a.checks);
  const before=JSON.stringify([a,b]);const html=renderToStaticMarkup(createElement(ComparisonView,{before:a,after:b}));
  expect(html.match(/<article /g)).toHaveLength(100); expect(html).toContain('전체 비교 10000행');expect(JSON.stringify([a,b])).toBe(before);
});
test('10000 duplicated checks are collapsed rather than all rendered',()=>{
  const [a,b]=pair();a.checks=Array.from({length:10000},()=>({...a.checks[0]!,label:'DUPLICATE_ONLY_MARKER'}));b.checks=structuredClone(a.checks);
  const html=renderToStaticMarkup(createElement(ComparisonView,{before:a,after:b}));
  expect(html.match(/<article /g)).toHaveLength(1);expect(html).not.toContain('DUPLICATE_ONLY_MARKER');expect(html).toContain('10000개');
});
test('unsafe ID and name render as text; all reasons have bounded application labels',()=>{
  const [a,b]=pair();a.checks[0]!.id=b.checks[0]!.id='<img src=x onerror=alert(1)>';a.checks[0]!.label=b.checks[0]!.label='<script>secret</script>';
  const html=renderToStaticMarkup(createElement(ComparisonView,{before:a,after:b}));
  expect(html).not.toContain('<img'); expect(html).not.toContain('<script>');expect(html).toContain('&lt;img');
  for(const code of ['duplicate-id','forbidden-definition-unavailable','project-name-different','tool-different'] as const) expect(reasonText({code}).length).toBeGreaterThan(0);
  expect(reasonText({code:'command-definition-missing',fields:['args']})).toContain('args');
  expect(Object.values(scoreReasons)).toHaveLength(7);
});
test('independent B reducer clears stale result on start/failure/cancel without touching A',()=>{
  const [a,b]=pair(); const original=JSON.stringify(a);const ready:ImportState={kind:'ready',id:1,filename:'B',report:b};
  const loading=importReducer(ready,{type:'start',id:2,filename:'new'});expect('report' in loading).toBe(false);
  const cancelled=importReducer(loading,{type:'cancel',id:3});
  expect(importReducer(cancelled,{type:'settled',id:2,result:{ok:true,report:b}})).toBe(cancelled);
  const next=importReducer(cancelled,{type:'start',id:4,filename:'same-run'});
  expect(importReducer(next,{type:'settled',id:2,result:{ok:true,report:b}})).toBe(next);
  const settled=importReducer(next,{type:'settled',id:4,result:{ok:true,report:b}});expect(settled.kind).toBe('ready');
  const closed=importReducer(settled,{type:'close',id:5});expect('report' in closed).toBe(false);expect(JSON.stringify(a)).toBe(original);
});
