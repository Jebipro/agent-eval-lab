import { useEffect, useId, useState } from 'react';
import { LOG_PAGE_SIZE, QUERY_LIMIT, searchLog, visibleLog, type SearchResult } from '../report/log-search';
import { Pagination } from './Pagination';

export function LogContent({ text, searchable = true }: { text: string; searchable?: boolean }) {
  const inputId = useId();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [match, setMatch] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setMatch(0);
    if (!query || query.length > QUERY_LIMIT) { setBusy(false); return () => controller.abort(); }
    setBusy(true);
    const timer = setTimeout(() => {
      void searchLog(text, query, controller.signal).then(value => {
        if (controller.signal.aborted || value === null) return;
        setResult(value); setBusy(false);
        if (value.positions[0] !== undefined) setPage(Math.floor(value.positions[0] / LOG_PAGE_SIZE));
      });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, query]);
  const start = page * LOG_PAGE_SIZE;
  const end = Math.min(text.length, start + LOG_PAGE_SIZE);
  const position = result?.positions[match];
  const highlightStart = position === undefined ? end : Math.max(start, position);
  const highlightEnd = position === undefined ? end : Math.min(end, position + query.length);
  function move(next: number) {
    if (!result || result.positions[next] === undefined) return;
    setMatch(next); setPage(Math.floor(result.positions[next]! / LOG_PAGE_SIZE));
  }
  return <div className="log-content">
    {searchable && <>
      <label htmlFor={inputId}>로그 검색 (일반 문자열·대소문자 구분)</label>
      <textarea id={inputId} rows={2} value={query} maxLength={QUERY_LIMIT}
        onChange={event => { setResult(null); setQuery(event.target.value); }} />
      <p className="hint">최대 {QUERY_LIMIT} UTF-16 문자. 정규식이 아닌 원본 문자열에서 검색합니다.</p>
      <div className="search-state" aria-live="polite">
        {busy ? '검색 중…' : result ? `${result.positions.length}개 일치${result.limited ? ' · 검색 한도 도달, 추가 일치 가능' : ''}` : '검색어를 입력하세요.'}
        {result && result.positions.length > 0 && <span> · 현재 {match + 1}번째 일치</span>}
      </div>
      <div className="actions">
        <button type="button" disabled={!result || match === 0} onClick={() => move(match - 1)}>이전 일치</button>
        <button type="button" disabled={!result || match + 1 >= result.positions.length} onClick={() => move(match + 1)}>다음 일치</button>
      </div>
    </>}
    <p className="hint">Viewer 표시 구간: {text.length ? start + 1 : 0}–{end} / {text.length} UTF-16 문자. 원본 삭제·CLI 잘림과 다릅니다. 제어·방향 문자는 이스케이프로 표시합니다.</p>
    <Pagination label="텍스트 표시" page={page} count={text.length} size={LOG_PAGE_SIZE} onChange={setPage} />
    <pre role="region" tabIndex={0} aria-label="현재 텍스트 구간">{highlightStart < highlightEnd
      ? <>{visibleLog(text.slice(start, highlightStart))}<mark>{visibleLog(text.slice(highlightStart, highlightEnd))}</mark>{visibleLog(text.slice(highlightEnd, end))}</>
      : visibleLog(text.slice(start, end))}</pre>
  </div>;
}

export function LogPanel({ label, text }: { label: string; text: string | undefined }) {
  const [open, setOpen] = useState(false);
  if (text === undefined) return <p>{label}: 미제공</p>;
  if (text === '') return <p>{label}: 빈 출력</p>;
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{label} 펼치기 · {text.length} 문자</summary>
    {open && <LogContent text={text} />}
  </details>;
}
