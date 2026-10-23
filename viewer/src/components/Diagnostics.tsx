import { useMemo, useState } from 'react';
import type { ReadonlyReport } from '../report/types';
import { consistencyWarnings } from '../report/consistency';
import { LIST_PAGE_SIZE } from '../report/log-search';
import { TextValue } from './Fields';
import { Pagination } from './Pagination';

function DiagnosticList({ label, items }: { label: string; items: ReadonlyReport['errors'] }) {
  const [page, setPage] = useState(0);
  return <div><h3>{label} · {items.length}개</h3>
    {!items.length && <p>기록 없음</p>}
    <Pagination label={label} page={page} count={items.length} size={LIST_PAGE_SIZE} onChange={setPage} />
    <ul aria-label={label}>{items.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE).map((item, offset) =>
      <li key={page * LIST_PAGE_SIZE + offset}>
        <p>code: <TextValue value={item.code} /></p>
        <p>message: <TextValue value={item.message} /></p>
        <p>hint: <TextValue value={item.hint} /></p>
      </li>)}</ul>
  </div>;
}
export function Diagnostics({ report }: { report: ReadonlyReport }) {
  const warnings = useMemo(() => consistencyWarnings(report), [report]);
  return <section id="diagnostics" aria-labelledby="diagnostics-title" className="panel">
    <h2 id="diagnostics-title">평가 진단</h2>
    <DiagnosticList label="CLI errors" items={report.errors} />
    <DiagnosticList label="CLI warnings" items={report.warnings} />
    <p className="hint">errors가 비어 있어도 전체 error 상태는 유효할 수 있습니다. 개별 검사 오류도 확인하세요.</p>
    <h3>Viewer 일관성 경고</h3>
    <p>CLI 진단과 별개입니다. 보고서 값을 보정하거나 출처의 진실성을 인증하지 않습니다.</p>
    {warnings.length ? <ul aria-label="Viewer 일관성 경고">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      : <p>점검한 교차 필드에서 불일치 없음</p>}
  </section>;
}
