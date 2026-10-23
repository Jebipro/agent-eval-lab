import { expect, test } from 'vitest';
import { droppedFiles, selectedFiles } from '../src/import/file-input';
import { importReducer, recovery, type ImportState } from '../src/app/import-state';
import { importError, errorMessages } from '../src/import/errors';
import { fixture } from './helpers';

const file = new File(['{}'], 'report.json');
test('picker cancellation is distinct from invalid Drop', () => {
  expect(selectedFiles([])).toEqual({ kind: 'none' });
  expect(droppedFiles({ files: [], items: [] })).toEqual({ kind: 'error', code: 'UnsupportedDrop' });
});
test('selection accepts content regardless of extension or MIME', () => {
  const unnamed = new File(['{}'], 'report.txt', { type: 'text/plain' });
  expect(selectedFiles([unnamed])).toEqual({ kind: 'file', file: unnamed });
});
test('multiple files are rejected for selection and Drop without choosing the first', () => {
  expect(selectedFiles([file, file])).toEqual({ kind: 'error', code: 'MultipleFiles' });
  expect(droppedFiles({ files: [file, file], items: [{ kind: 'file' }, { kind: 'file' }] })).toEqual({ kind: 'error', code: 'MultipleFiles' });
});
test.each([
  { files: [], items: [{ kind: 'string' }] },
  { files: [file], items: [{ kind: 'file', webkitGetAsEntry: () => ({ isDirectory: true }) }] },
  { files: [file], items: [{ kind: 'file' }, { kind: 'string' }] },
  { files: [], items: [{ kind: 'file' }] },
  { files: [file], items: [{ kind: 'file' }, { kind: 'file' }] },
  { files: [file], items: [{ kind: 'file', webkitGetAsEntry: () => { throw new Error('SECRET'); } }] }
])('reject unsupported or unreadable Drop %#', transfer => {
  expect(droppedFiles(transfer)).toEqual({ kind: 'error', code: 'UnsupportedDrop' });
});
test.each([{ items: [] }, { items: [{ kind: 'file' }] }, { items: [{ kind: 'file', webkitGetAsEntry: () => null }] }])('single file Drop supports browser item variants %#', ({ items }) => {
  expect(droppedFiles({ files: [file], items })).toEqual({ kind: 'file', file });
});
const ready: ImportState = { kind: 'ready', id: 1, filename: 'old.json', report: fixture() };
test.each(['close', 'cancel'] as const)('%s releases filename and report; late success cannot revive either', type => {
  const state = importReducer(ready, { type, id: 2 });
  expect(state).toEqual({ kind: type === 'close' ? 'empty' : 'cancelled', id: 2 });
  expect(importReducer(state, { type: 'settled', id: 1, result: { ok: true, report: fixture() } })).toBe(state);
});
test('replacement immediately releases previous report and ignores out-of-order completion', () => {
  const loading = importReducer(ready, { type: 'start', id: 2, filename: 'new.json' });
  expect(loading).toEqual({ kind: 'loading', id: 2, filename: 'new.json' });
  expect(importReducer(loading, { type: 'settled', id: 1, result: { ok: true, report: fixture() } })).toBe(loading);
  const error = importReducer(loading, { type: 'settled', id: 2, result: { ok: false, error: importError('ResourceLimitError') } });
  expect(error).toMatchObject({ kind: 'error', filename: 'new.json' });
  expect(error).not.toHaveProperty('report');
});
test.each(['MultipleFiles', 'UnsupportedDrop'] as const)('invalid input %s clears previous report and filename', code => {
  const state = importReducer(ready, { type: 'reject', id: 2, code });
  expect(state).toMatchObject({ kind: 'error', filename: null, error: { code } });
  expect(state).not.toHaveProperty('report');
});
test('every parser/Worker error has a static actionable recovery hint', () => {
  for (const code of Object.keys(errorMessages) as (keyof typeof errorMessages)[]) {
    expect(recovery[code].length).toBeGreaterThan(10);
  }
});
