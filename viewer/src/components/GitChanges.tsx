import { useMemo, useState } from 'react';
import type { ReadonlyReport } from '../report/types';
import { LIST_PAGE_SIZE } from '../report/log-search';
import { booleanText, Field, TextValue } from './Fields';
import { Violations } from './Checks';
import { Pagination } from './Pagination';

export function GitChanges({ report, idPrefix = 'git', labelPrefix = '' }: { report: ReadonlyReport; idPrefix?: string; labelPrefix?: string }) {
  const git = report.git;
  const [page, setPage] = useState(0);
  const [gatePage, setGatePage] = useState(0);
  const gates = useMemo(() => report.checks.filter(c => c.kind === 'forbidden'), [report]);
  return <section id={`${idPrefix}-changes`} aria-labelledby={`${idPrefix}-title`} className="panel">
    <h2 id={`${idPrefix}-title`}>{labelPrefix}Git Changes · 변경 기록</h2>
    {git === null ? <p>Git 분석 결과 없음 (git=null)</p> : !git.enabled ? <p>Git 검사 비활성 (enabled=false). 깨끗한 저장소 또는 보호 검사 PASS를 뜻하지 않습니다.</p> : <>
      <dl>
        <Field label="기준 ref">{git.baseRef === null ? '없음 (null)' : <TextValue value={git.baseRef} />}</Field>
        <Field label="기준 SHA">{git.baseSha === null ? '없음 (null)' : <TextValue value={git.baseSha} />}</Field>
        <Field label="수집 시각 (원본 ISO)"><TextValue value={git.capturedAt} /></Field>
        <Field label="수집 시점">명령 실행 전 snapshot ({git.timing})</Field>
        <Field label="통계의 파일 수">{git.stats.files}</Field>
        <Field label="알려진 tracked 텍스트 합계">추가 {git.stats.additions} / 삭제 {git.stats.deletions}</Field>
        <Field label="불완전한 Git 통계">{booleanText(git.stats.incomplete)}</Field>
      </dl>
      <p>기준 SHA는 현재 HEAD나 최신 커밋을 뜻하지 않습니다. 명령 실행 중·후의 변경은 이 snapshot으로 확인할 수 없습니다.</p>
      {git.stats.incomplete && <p className="attention">전체 줄 수가 아닙니다. binary/untracked 등 알 수 없는 줄 수가 포함될 수 있습니다. Git 통계 incomplete는 평가 scoreComplete와 별개입니다.</p>}
      <p>변경 목록: {git.changes.length}개 기록</p>
      <Pagination label={`${labelPrefix}Git 변경 목록`} page={page} count={git.changes.length} size={LIST_PAGE_SIZE} onChange={setPage} />
      {!git.changes.length && <p>기록된 변경 없음</p>}
      <ul className="change-list" aria-label="Git 변경 파일">{git.changes.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE).map((change, offset) =>
        <li key={page * LIST_PAGE_SIZE + offset}>
          <dl>
            <Field label="상태"><TextValue value={change.status} /></Field>
            <Field label="경로"><TextValue value={change.path} /></Field>
            <Field label="이전 경로">{change.oldPath === null ? '없음 (null)' : <TextValue value={change.oldPath} />}</Field>
            <Field label="추가 줄">{change.additions === null ? '알 수 없음 (null)' : change.additions}</Field>
            <Field label="삭제 줄">{change.deletions === null ? '알 수 없음 (null)' : change.deletions}</Field>
            <Field label="binary">{booleanText(change.binary)}</Field>
          </dl>
        </li>)}</ul>
    </>}
    <h3>보고서의 금지 파일 검사</h3>
    <p className="hint">Checks의 기록을 그대로 참조합니다. 새로운 glob 검사나 규칙 추정은 하지 않습니다.</p>
    {!gates.length && <p>보고서에 보호 검사 결과 없음</p>}
    <Pagination label={`${labelPrefix}보호 검사 목록`} page={gatePage} count={gates.length} size={LIST_PAGE_SIZE} onChange={setGatePage} />
    {gates.slice(gatePage * LIST_PAGE_SIZE, (gatePage + 1) * LIST_PAGE_SIZE).map((gate, offset) =>
      <div key={gatePage * LIST_PAGE_SIZE + offset}><p>검사 id: <TextValue value={gate.id} /></p><Violations values={gate.violations} /></div>)}
  </section>;
}
