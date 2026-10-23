import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import manifest from '../samples/manifest.json';
import { candidates, candidateById, exampleKind, loadExampleText } from '../src/examples/catalog';
import { payloads } from '../src/generated/example-data';
import { parseBytes } from '../src/import/parse';
import { ExamplePicker } from '../src/components/ExamplePicker';
import { resolveTheme, ThemeControl, type ThemeMode } from '../src/components/ThemeControl';

afterEach(() => vi.useRealTimers());
test.each(candidates)('candidate $id retains source, contract, provenance and approval boundary', async item => {
  expect(item.source).toMatch(/^tests\/fixtures\/(official|synthetic)\//);
  expect(item.source).not.toMatch(/real|mini-lang/);
  expect(manifest.publicSampleApproved).toBe(true);
  expect(item.approval).toBe('approved-by-user');
  expect(item.review.result).toContain('No sensitive values');
  const original = readFileSync(new URL('../'+item.source, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  expect(payloads[item.id]).toBe(original);
  expect(createHash('sha256').update(original).digest('hex')).toBe(item.sha256);
  const loaded = await loadExampleText(item.id, new AbortController().signal);
  const result = parseBytes(new TextEncoder().encode(loaded));
  expect(result).toEqual({ok: true, report: JSON.parse(original)});
  expect(candidateById(item.id)).toBe(item);
  expect(exampleKind(item.kind)).toBe(item.kind === 'official' ? '공식 실행 기록' : '합성 예제');
});
test('catalog has exactly the seven explicitly approved examples', () => {
  expect(candidates).toHaveLength(7);
  expect(candidates.map(c => c.id).sort()).toEqual(['cancelled', 'failure', 'forbidden', 'optional', 'setup', 'success', 'timeout']);
  expect(candidates.filter(c => c.kind === 'official')).toHaveLength(4);
  expect(candidates.filter(c => c.kind === 'synthetic')).toHaveLength(3);
  const html = renderToStaticMarkup(createElement(ExamplePicker, {selected: 'setup', onSelect: () => {}, onOpen: () => {}}));
  expect(html).toContain('합성 예제'); expect(html).toContain('공개 승인된');
  expect(html).toContain('실제 실행 기록이 아닙니다');
});
test('unknown id and pre-aborted load never run importer', async () => {
  const importer = vi.fn(async () => ({payloads}));
  await expect(loadExampleText('../../real', new AbortController().signal, importer)).rejects.toThrow('Example unavailable');
  const abort = new AbortController(); abort.abort();
  await expect(loadExampleText('success', abort.signal, importer)).rejects.toThrow('Example unavailable');
  expect(importer).not.toHaveBeenCalled();
});
test('module failure and missing payload become static errors', async () => {
  await expect(loadExampleText('success', new AbortController().signal, async () => { throw new Error('PRIVATE_NATIVE'); })).rejects.toThrow(/^Example unavailable$/);
  await expect(loadExampleText('success', new AbortController().signal, async () => ({payloads: {}}))).rejects.toThrow(/^Example unavailable$/);
});
test('load timeout is finite, removes timer, and ignores late completion', async () => {
  vi.useFakeTimers(); let finish!: (v: {payloads: Record<string,string>}) => void;
  const pending = loadExampleText('success', new AbortController().signal, () => new Promise(resolve => {finish=resolve;}));
  const assertion = expect(pending).rejects.toThrow('Example unavailable');
  await vi.advanceTimersByTimeAsync(5000); await assertion;
  finish({payloads: {success: 'late'}}); await Promise.resolve();
  expect(vi.getTimerCount()).toBe(0);
});
test('abort releases loading promise and timer without stale value', async () => {
  vi.useFakeTimers(); const abort = new AbortController();
  const pending = loadExampleText('success', abort.signal, () => new Promise(() => {}));
  const assertion = expect(pending).rejects.toThrow('Example unavailable');
  abort.abort(); await assertion; expect(vi.getTimerCount()).toBe(0);
});
test.each([
  ['system', false, 'light'], ['system', true, 'dark'], ['light', false, 'light'],
  ['light', true, 'light'], ['dark', false, 'dark'], ['dark', true, 'dark']
] as const)('theme %s, dark system %s resolves to %s', (mode, dark, expected) => {
  expect(resolveTheme(mode as ThemeMode, dark)).toBe(expected);
});
test('theme control defaults to system and has a visible accessible label', () => {
  const html = renderToStaticMarkup(createElement(ThemeControl));
  expect(html).toContain('화면 테마'); expect(html).toContain('value="system" selected');
});
