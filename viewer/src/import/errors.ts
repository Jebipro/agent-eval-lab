export const errorMessages = {
  ReadError: '파일을 읽을 수 없습니다.',
  DecodeError: 'UTF-8 JSON 파일이 아닙니다.',
  ParseError: 'JSON 문법이 올바르지 않습니다.',
  UnsupportedVersion: '지원하지 않는 schemaVersion입니다. 숫자 1만 지원합니다.',
  SchemaError: 'Agent Eval Lab 보고서 v1 구조와 일치하지 않습니다.',
  ResourceLimitError: 'Viewer 처리 한도를 초과했습니다.',
  WorkerError: '검증 Worker를 실행하거나 결과를 전달할 수 없습니다.',
  Cancelled: '파일 검증을 취소했습니다.'
} as const;
export type ErrorCode = keyof typeof errorMessages;
export interface Issue { readonly path: string; readonly keyword: string }
export interface ImportError { readonly code: ErrorCode; readonly message: string; readonly issues: readonly Issue[] }
export function importError(code: ErrorCode, issues: readonly Issue[] = []): ImportError {
  return { code, message: errorMessages[code], issues };
}
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(errorMessages, value);
}
