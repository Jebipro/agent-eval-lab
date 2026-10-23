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
