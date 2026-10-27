import type { ReadonlyReport } from './types';

export interface CheckFilters {
  query: string;
  status: 'all' | ReadonlyReport['checks'][number]['status'];
  required: 'all' | 'required' | 'optional';
}
export const EMPTY_CHECK_FILTERS: CheckFilters = { query: '', status: 'all', required: 'all' };

/** Literal, case-sensitive search; indices retain source ordering and identity. */
export function matchingCheckIndices(checks: ReadonlyReport['checks'], filters: CheckFilters): number[] {
  const indices: number[] = [];
  checks.forEach((check, index) => {
    if (filters.query && !check.id.includes(filters.query) && !check.label.includes(filters.query)) return;
    if (filters.status !== 'all' && check.status !== filters.status) return;
    if (filters.required !== 'all' && check.required !== (filters.required === 'required')) return;
    indices.push(index);
  });
  return indices;
}
