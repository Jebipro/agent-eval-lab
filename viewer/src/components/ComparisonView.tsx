import { useMemo, useState } from 'react';
import type { ReadonlyReport } from '../report/types';
import { compareReports, type CheckReference } from '../report/compare';
import { changeLabels, comparisonRows, reasonText, references, scoreReasons } from '../report/comparison-view';
import { displayText } from '../report/view-model';
import { Field, Status, TextValue } from './Fields';
import { Pagination } from './Pagination';
import { GitChanges } from './GitChanges';

function ReportHeader({ report, side }: { report: ReadonlyReport; side: string }) {
  return <section className="panel" aria-label={side}>
    <h3>{side}</h3><dl>
      <Field label="프로젝트"><TextValue value={report.project.name} /></Field>
      <Field label="도구 버전"><TextValue value={report.tool.name + ' ' + report.tool.version} /></Field>
      <Field label="실행 ID"><TextValue value={report.run.id} /></Field>
      <Field label="실행 시각 (원본 ISO)"><TextValue value={report.run.startedAt} /></Field>
      <Field label="원본 평가 상태"><Status value={report.status} /></Field>
      <Field label="원본 종료 코드">{report.exitCode}</Field>
      <Field label="원본 점수">{report.score === null ? '점수 없음 (null)' : report.score}</Field>
      <Field label="점수 완전성">{report.scoreComplete ? '완전 (true)' : '불완전 (false)'}</Field>
      <Field label="원본 summary.total">{report.summary.total}</Field>
      <Field label="검사 기록 수">{report.checks.length}</Field>
    </dl>
  </section>;
}
function SideChecks({ items, side }: { items: readonly CheckReference[]; side: string }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const content = <>
    <Pagination label={`${side} 중복 검사 · 원본 시작 #${(items[0]?.index ?? 0) + 1} · ID ${displayText(items[0]?.check.id ?? '', 80)}`} page={page} count={items.length} size={100} onChange={setPage} />
    {items.slice(page * 100, (page + 1) * 100).map(item => <p key={item.index}>
      원본 #{item.index + 1} · <TextValue value={item.check.label} /> · <Status value={item.check.status} />
    </p>)}
  </>;
  return <div><h4>{side} 원본 검사 · {items.length}개</h4>
    {!items.length && <p>해당 보고서에 없음</p>}
    {items.length > 1 ? <details onToggle={e => setOpen(e.currentTarget.open)}><summary>{side} 중복 원본 검사 펼치기</summary>{open && content}</details> : content}
  </div>;
}
export function ComparisonView({ before, after }: { before: ReadonlyReport; after: ReadonlyReport }) {
  const result = useMemo(() => compareReports(before, after), [before, after]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => comparisonRows(result.checks, query, type), [result, query, type]);
  const paired = result.checks.filter(r => r.type === 'status-changed' || r.type === 'status-unchanged').length;
  const unknown = result.checks.filter(r => r.type === 'incomparable');
  return <section className="comparison-view panel" aria-labelledby="comparison-title">
    <h2 id="comparison-title">두 보고서 비교</h2>
    <p>A · 이전(Before) / B · 이후(After)는 선택 순서입니다. 실행 시각으로 정렬하거나 동일한 코드·환경이라고 추정하지 않습니다.</p>
    <div className="import-grid"><ReportHeader report={before} side="A · 이전(Before)" /><ReportHeader report={after} side="B · 이후(After)" /></div>
    <h3>점수와 비교 범위</h3>
    <p>원시 점수 차이 (B − A): {result.score.rawDelta === null ? '계산 불가 (null)' : result.score.rawDelta}. 품질 향상·악화 판정이 아닙니다.</p>
    <p>같은 기록 필드라도 실제 코드·환경·전체 설정의 동일성을 보장하지 않습니다.</p>
    {result.score.restrictions.length ? <ul aria-label="점수 비교 제한 사유">{result.score.restrictions.map(r => <li key={r}>{scoreReasons[r]}</li>)}</ul> : <p>기록된 필드 기준 비교 제한 없음. 점수의 품질 판단은 하지 않습니다.</p>}
    <p>직접 비교 가능한 검사: {paired}쌍. 비교 불가: A {unknown.reduce((n,r) => n + references(r, 'before').length, 0)}개 / B {unknown.reduce((n,r) => n + references(r, 'after').length, 0)}개 ({unknown.length}개 ID 그룹).</p>
    <p>A에만 존재: {result.checks.filter(r => r.type === 'before-only').length}개 / B에만 존재: {result.checks.filter(r => r.type === 'after-only').length}개. 한쪽만 있는 항목은 상태 변화로 판정하지 않습니다.</p>
    <h3>검사 비교 목록</h3>
    <div className="comparison-filters">
    <div className="comparison-filter-field">
    <label htmlFor="comparison-search">비교 검사 ID 또는 이름 검색</label>
    <input id="comparison-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
    </div>
    <div className="comparison-filter-field">
    <label htmlFor="comparison-type">검사 변화 유형</label>
    <select id="comparison-type" value={type} onChange={e => { setType(e.target.value); setPage(0); }}>
      <option value="all">전체</option>{Object.entries(changeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    </div>
    <button type="button" onClick={() => { setQuery(''); setType('all'); setPage(0); }}>비교 필터 초기화</button>
    </div>
    <p className="comparison-count" aria-live="polite" aria-atomic="true">필터 결과 {rows.length}행 / 전체 비교 {result.checks.length}행. 평가 검사 총수가 아닙니다.</p>
    <p className="hint">일반 문자열·대소문자 구분 검색. A의 원본 ID 순서, 이어서 B에만 있는 ID 순서로 표시합니다. 중복 ID는 한 그룹으로 표시합니다.</p>
    <Pagination label="검사 비교 목록" page={page} count={rows.length} size={100} onChange={setPage} />
    {!rows.length && <p>조건에 맞는 비교 결과가 없습니다. 비교 불가 판정과는 다릅니다.</p>}
    {rows.slice(page * 100, (page + 1) * 100).map(row => <article className="panel comparison-row" key={row.id}>
      <h3>{changeLabels[row.type]} · <TextValue value={row.id} /></h3>
      {row.type === 'incomparable' && <><p>두 상태를 직접적인 상태 변화로 해석하지 마세요.</p><ul>{row.reasons.map((r,i) => <li key={i}>{reasonText(r)}</li>)}</ul></>}
      <SideChecks items={references(row, 'before')} side="A" /><SideChecks items={references(row, 'after')} side="B" />
    </article>)}
    <h3>독립적인 Git snapshot</h3>
    <p>각 보고서의 수집 시점 기록입니다. A와 B 사이의 실제 코드 diff 또는 최신 상태가 아닙니다.</p>
    <section aria-label="A Git snapshot"><h3>A · 이전(Before) Git snapshot</h3><GitChanges report={before} idPrefix="comparison-before-git" labelPrefix="A · " /></section>
    <section aria-label="B Git snapshot"><h3>B · 이후(After) Git snapshot</h3><GitChanges report={after} idPrefix="comparison-after-git" labelPrefix="B · " /></section>
  </section>;
}
