import { useState, type ReactNode } from 'react';
import { displayText } from '../report/view-model';
import { LogContent } from './LogPanel';

/** Bounded inline strings; full values are available through a paged text view. */
export function TextValue({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  return <><bdi>{displayText(value, 512)}</bdi>{value.length > 512 && <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>전체 값 보기</summary>{open && <LogContent text={value} searchable={false} />}
  </details>}</>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><dt>{label}</dt><dd>{children}</dd></div>;
}
const statusLabels = { passed: '통과', failed: '실패', error: '오류', cancelled: '취소',
  pass: '통과', fail: '실패', skipped: '건너뜀' };
export function Status({ value }: { value: keyof typeof statusLabels }) {
  return <span className={`badge status-${value}`}>{statusLabels[value]} ({value})</span>;
}
export const booleanText = (value: boolean | undefined): string => value === undefined ? '미제공' : value ? '예 (true)' : '아니요 (false)';
