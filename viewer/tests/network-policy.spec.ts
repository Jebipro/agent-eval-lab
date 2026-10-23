import { expect, test } from 'vitest';
import { exactLocalReads, requestKind, type ObservedRequest } from '../e2e/network-policy';
const base = 'http://127.0.0.1:4173/agent-eval-lab/';
const worker = base + 'assets/import.worker-EXACT.js';
const assets = new Map([[worker, 'worker']]);
const blob = 'blob:http://127.0.0.1:4173/00000000-0000-0000-0000-000000000000';
const request = (url: string, overrides: Partial<ObservedRequest> = {}): ObservedRequest => ({ url, method: 'GET', body: null, kind: 'xhr', ...overrides });
test('rejects extra, missing or different blob responses even at the correct origin', () => {
  const payload = Buffer.from('PRIVATE_INPUT');
  expect(exactLocalReads('webkit', [payload], payload)).toBe(true);
  expect(exactLocalReads('webkit', [Buffer.from('OTHER')], payload)).toBe(false);
  expect(exactLocalReads('webkit', [payload, payload], payload)).toBe(false);
  expect(exactLocalReads('webkit', [], payload)).toBe(false);
  expect(exactLocalReads('chromium', [payload], payload)).toBe(false);
});
test('only the exact built worker permits the WebKit xhr classification', () => {
  expect(requestKind(request(worker), 'webkit', assets)).toBe('asset');
  expect(requestKind(request(worker, { kind: 'script' }), 'chromium', assets)).toBe('asset');
  expect(requestKind(request(worker), 'chromium', assets)).toBe('reject');
});
test.each([worker + '?secret=x', base + 'assets/other.js', 'https://invalid.test/', blob.replace(':4173', ':4174'), blob + '?x', 'blob:null/anything'])('rejects unlisted URL %s', url => {
  expect(requestKind(request(url), 'webkit', assets)).toBe('reject');
});
test('blob is only a candidate requiring a separate exact-response check', () => {
  expect(requestKind(request(blob), 'webkit', assets)).toBe('local-blob');
  expect(requestKind(request(blob), 'chromium', assets)).toBe('reject');
  expect(requestKind(request(blob, { method: 'POST' }), 'webkit', assets)).toBe('reject');
  expect(requestKind(request(blob, { body: 'SECRET' }), 'webkit', assets)).toBe('reject');
  expect(requestKind(request(worker, { body: 'SECRET' }), 'webkit', assets)).toBe('reject');
});

const favicon = base + 'favicon.svg';
const faviconAssets = new Map([[favicon, 'other'], [base + 'other.svg', 'other']]);
test('Firefox exact favicon image classification is a static asset only', () => {
  expect(requestKind(request(favicon, { kind: 'image' }), 'firefox', faviconAssets)).toBe('asset');
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    expect(requestKind(request(favicon, { kind: 'other' }), engine, faviconAssets)).toBe('asset');
  }
});
test.each([
  [favicon + '?secret=x', 'firefox', 'GET', null],
  [favicon + '#secret', 'firefox', 'GET', null],
  [base + 'other.svg', 'firefox', 'GET', null],
  ['https://invalid.test/agent-eval-lab/favicon.svg', 'firefox', 'GET', null],
  [favicon.replace(':4173', ':4174'), 'firefox', 'GET', null],
  [favicon, 'firefox', 'POST', null],
  [favicon, 'firefox', 'GET', 'SECRET'],
  [favicon, 'firefox', 'GET', ''],
  [favicon, 'chromium', 'GET', null],
  [favicon, 'webkit', 'GET', null],
] as const)('favicon exception rejects %s / %s / %s / %s', (url, engine, method, body) => {
  expect(requestKind(request(url, { kind: 'image', method, body }), engine, faviconAssets)).toBe('reject');
});
test('Firefox favicon exception still requires an explicit asset entry and expected type', () => {
  expect(requestKind(request(favicon, { kind: 'image' }), 'firefox', new Map())).toBe('reject');
  expect(requestKind(request(favicon, { kind: 'image' }), 'firefox', new Map([[favicon, 'worker']]))).toBe('reject');
  expect(requestKind(request(favicon, { kind: 'xhr' }), 'firefox', faviconAssets)).toBe('reject');
});
