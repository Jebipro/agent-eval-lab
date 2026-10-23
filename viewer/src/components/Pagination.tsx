export function Pagination({ label, page, count, size, onChange }: {
  label: string; page: number; count: number; size: number; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  if (pages === 1) return null;
  return <nav className="pagination" aria-label={`${label} 페이지`}>
    <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>이전 페이지</button>
    <span aria-live="polite">{page + 1} / {pages} 페이지 · 전체 {count}</span>
    <button type="button" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>다음 페이지</button>
  </nav>;
}
