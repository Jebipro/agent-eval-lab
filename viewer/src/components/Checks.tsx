import { useState } from 'react';
import type { ReadonlyReport } from '../report/types';
import { LIST_PAGE_SIZE } from '../report/log-search';
import { booleanText, Field, Status, TextValue } from './Fields';
import { LogPanel } from './LogPanel';
import { Pagination } from './Pagination';

type Check = ReadonlyReport['checks'][number];
export function Violations({ values }: { values: Check['violations'] }) {
  const [page, setPage] = useState(0);
  if (values === undefined) return <p>위반 목록: 미제공</p>;
  if (!values.length) return <p>기록된 위반 없음 (violations=[])</p>;
  return <div>
    <Pagination label="위반 목록" page={page} count={values.length} size={LIST_PAGE_SIZE} onChange={setPage} />
    <ul aria-label="금지 파일 위반">{values.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE).map((value, index) =>
      <li key={page * LIST_PAGE_SIZE + index}>경로: <TextValue value={value.path} /> · 일치 패턴: <TextValue value={value.pattern} /></li>)}</ul>
  </div>;
}
export function CheckCard({ check: c, index }: { check: Check; index: number }) {
  const [open, setOpen] = useState(false);
  return <article className="check-card" aria-label={`검사 ${index + 1}`}>
    <h3>{index + 1}. <TextValue value={c.label} /></h3>
    <dl className="metrics">
      <Field label="id"><TextValue value={c.id} /></Field>
      <Field label="종류">{c.kind === 'command' ? '명령 (command)' : '금지 파일 (forbidden)'}</Field>
      <Field label="필수 여부">{c.required ? '필수 (required=true)' : '선택 (required=false)'}</Field>
      <Field label="검사 상태"><Status value={c.status} /></Field>
      <Field label="실행 시간">{c.durationMs} ms</Field>
      <Field label="검사 종료 코드">{c.exitCode === null ? '종료 코드 없음 (null)' : c.exitCode}</Field>
    </dl>
    <p>사유: {c.reason === null ? '없음 (null)' : <TextValue value={c.reason} />}</p>
    <details className={c.status === 'fail' || c.status === 'error' ? 'attention' : ''}
      onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>검사 상세·로그 펼치기</summary>
      {open && <CheckDetails check={c} />}
    </details>
  </article>;
}
export function CheckDetails({ check: c }: { check: Check }) {
  return <>
    <dl>
      <Field label="실행 파일">{c.command === undefined ? '미제공' : <TextValue value={c.command} />}</Field>
      <Field label="인자 (JSON 배열)">{c.args === undefined ? '미제공' : <TextValue value={JSON.stringify(c.args)} />}</Field>
      <Field label="시간 제한 초과 (timedOut)">{booleanText(c.timedOut)}</Field>
      <Field label="signal">{c.signal === undefined ? '미제공' : c.signal === null ? '없음 (null)' : <TextValue value={c.signal} />}</Field>
      <Field label="CLI 출력 잘림 (outputTruncated)">{c.outputTruncated === undefined ? '미제공' : c.outputTruncated ? 'CLI가 출력을 잘랐음 (true)' : 'CLI 잘림 없음 (false)'}</Field>
    </dl>
    <p className="hint">명령은 텍스트로만 표시합니다. 종료 코드만으로 상태를 다시 판정하지 않습니다. CLI가 잘라낸 출력은 복원할 수 없습니다.</p>
    <LogPanel label="stdout" text={c.stdout} />
    <LogPanel label="stderr" text={c.stderr} />
    {(c.kind === 'forbidden' || c.violations !== undefined) && <Violations values={c.violations} />}
  </>;
}
export function Checks({ checks }: { checks: ReadonlyReport['checks'] }) {
  const [page, setPage] = useState(0);
  return <section id="checks" aria-labelledby="checks-title" className="panel">
    <h2 id="checks-title">Checks · 검사 결과</h2>
    <p>보고서 배열 순서 · {checks.length}개 기록 · 페이지당 최대 {LIST_PAGE_SIZE}개</p>
    {!checks.length && <p>검사 기록 없음</p>}
    <Pagination label="검사 목록" page={page} count={checks.length} size={LIST_PAGE_SIZE} onChange={setPage} />
    {checks.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE).map((check, offset) =>
      <CheckCard key={page * LIST_PAGE_SIZE + offset} check={check} index={page * LIST_PAGE_SIZE + offset} />)}
  </section>;
}
