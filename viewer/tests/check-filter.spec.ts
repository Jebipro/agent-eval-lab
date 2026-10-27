import { test, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { matchingCheckIndices, EMPTY_CHECK_FILTERS } from '../src/report/check-filter';
import { Checks } from '../src/components/Checks';
import { fixture } from './helpers';
const seed = fixture().checks[0]!;
const checks = ['pass', 'fail', 'error', 'skipped'].map((status, i) => ({ ...seed, id: `id-${i}`, label: i === 2 ? '한글 [.*] <img>' : `Name ${i}`, status: status as typeof seed.status, required: i % 2 === 0 }));
test.each(['pass', 'fail', 'error', 'skipped'] as const)('status %s', status => {
  expect(matchingCheckIndices(checks, { ...EMPTY_CHECK_FILTERS, status })).toEqual([checks.findIndex(c => c.status === status)]);
});
test.each(['required', 'optional'] as const)('requirement %s', required => {
  expect(matchingCheckIndices(checks, { ...EMPTY_CHECK_FILTERS, required })).toEqual(required === 'required' ? [0, 2] : [1, 3]);
});
test('ID and label search is literal, case sensitive and preserves spaces', () => {
  for (const query of ['id-2', '한글', '[.*]', '<img>']) expect(matchingCheckIndices(checks, { ...EMPTY_CHECK_FILTERS, query })).toEqual([2]);
  for (const query of ['.*Name', 'name', ' Name']) expect(matchingCheckIndices(checks, { ...EMPTY_CHECK_FILTERS, query })).toEqual([]);
});
test('combined conditions and zero results', () => {
  expect(matchingCheckIndices(checks, { query: 'id-', status: 'fail', required: 'optional' })).toEqual([1]);
  expect(matchingCheckIndices(checks, { query: 'id-', status: 'fail', required: 'required' })).toEqual([]);
  expect(matchingCheckIndices([], EMPTY_CHECK_FILTERS)).toEqual([]);
});
test('source order, duplicate IDs and original objects are preserved', () => {
  const r = fixture(); const before = JSON.stringify(r);
  expect(matchingCheckIndices(r.checks, EMPTY_CHECK_FILTERS)).toEqual(r.checks.map((_, i) => i));
  expect(JSON.stringify(r)).toBe(before);
  expect(matchingCheckIndices([checks[2]!, checks[2]!, checks[0]!], EMPTY_CHECK_FILTERS)).toEqual([0, 1, 2]);
});
test('10000 checks render at most 100 cards and expose labels/live count', () => {
  const many = Array.from({ length: 10000 }, (_, i) => ({ ...seed, id: String(i) }));
  expect(matchingCheckIndices(many, EMPTY_CHECK_FILTERS)).toHaveLength(10000);
  const html = renderToStaticMarkup(createElement(Checks, { checks: many }));
  expect(html.match(/<article /g)).toHaveLength(100);
  expect(html).toContain('aria-live="polite"'); expect(html).toContain('전체 검사 기록 10000개');
  expect(html).toContain('검사 ID 또는 이름 검색');
});
