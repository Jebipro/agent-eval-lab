import type { ImportError } from '../import/errors';
import type { InputError } from '../import/file-input';
import type { ParseResult } from '../import/parse';
import type { ReadonlyReport } from '../report/types';

export type ImportState =
  | { kind: 'empty' | 'cancelled'; id: number }
  | { kind: 'loading'; id: number; filename: string }
  | { kind: 'ready'; id: number; filename: string; report: ReadonlyReport }
  | { kind: 'error'; id: number; filename: string | null; error: ImportError | { code: InputError; message: string; issues: [] } };
export type ImportAction =
  | { type: 'start'; id: number; filename: string }
  | { type: 'settled'; id: number; result: ParseResult }
  | { type: 'reject'; id: number; code: InputError }
  | { type: 'close' | 'cancel'; id: number };

export function importReducer(state: ImportState, action: ImportAction): ImportState {
  if (action.type === 'settled') {
    if (state.kind !== 'loading' || state.id !== action.id) return state;
    return action.result.ok
      ? { kind: 'ready', id: state.id, filename: state.filename, report: action.result.report }
      : { kind: 'error', id: state.id, filename: state.filename, error: action.result.error };
  }
  if (action.id <= state.id) return state;
  switch (action.type) {
    case 'start': return { kind: 'loading', id: action.id, filename: action.filename };
    case 'close': return { kind: 'empty', id: action.id };
    case 'cancel': return { kind: 'cancelled', id: action.id };
    case 'reject': return {
      kind: 'error', id: action.id, filename: null,
      error: { code: action.code, message: action.code === 'MultipleFiles'
        ? '한 번에 파일 하나만 열 수 있습니다.' : '폴더·링크·텍스트는 열 수 없습니다. 로컬 파일 하나를 놓아 주세요.', issues: [] }
    };
  }
}

export const recovery = {
  ReadError: '파일에 접근할 수 있는지 확인한 뒤 다시 선택해 주세요.',
  DecodeError: 'UTF-8로 저장한 JSON 보고서를 선택해 주세요.',
  ParseError: '파일이 완전한 JSON인지 확인해 주세요. 원본 오류 내용은 표시하지 않습니다.',
  UnsupportedVersion: 'schemaVersion이 숫자 1인 Agent Eval Lab 보고서가 필요합니다.',
  SchemaError: '설정 YAML이나 보조 요약이 아닌 Agent Eval Lab JSON 보고서인지 확인해 주세요.',
  ResourceLimitError: '10 MiB 또는 구조·처리 시간(5초) 한도를 초과했습니다. 더 작은 보고서를 선택해 주세요.',
  WorkerError: '브라우저에서 Worker를 실행할 수 있는지 확인하고 다시 선택해 주세요.',
  Cancelled: '필요하면 같은 파일이나 다른 파일을 다시 선택할 수 있습니다.',
  MultipleFiles: '파일을 하나만 선택하거나 놓아 주세요. 이전 보고서는 닫혔습니다.',
  UnsupportedDrop: '파일 선택 버튼으로도 열 수 있습니다. URL을 가져오거나 폴더를 탐색하지 않습니다.'
} as const;
