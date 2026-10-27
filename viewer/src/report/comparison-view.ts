import type { CheckComparison, CheckReference, ComparisonReason, ScoreRestriction } from './compare';
export const changeLabels: Record<CheckComparison['type'], string> = {
  'status-changed': '상태 변경', 'status-unchanged': '상태 유지', 'before-only': 'A에만 존재', 'after-only': 'B에만 존재', incomparable: '비교 불가'
};
export function references(row: CheckComparison, side: 'before' | 'after'): readonly CheckReference[] {
  if (row.type === 'incomparable') return row[side];
  return side in row ? [(row as { before?: CheckReference; after?: CheckReference })[side]!] : [];
}
export function comparisonRows(rows: readonly CheckComparison[], query: string, type: string) {
  return rows.filter(row => (type === 'all' || row.type === type) && (row.id.includes(query)
    || references(row, 'before').some(r => r.check.label.includes(query)) || references(row, 'after').some(r => r.check.label.includes(query))));
}
export function reasonText(reason: ComparisonReason): string {
  switch (reason.code) {
    case 'duplicate-id': return '중복 ID: 원본 검사들을 임의로 대응시키지 않았습니다.';
    case 'definition-changed': return '검사 정의 변경: ' + reason.fields.join(', ');
    case 'command-definition-missing': return '명령 정의가 없거나 불명확함: ' + reason.fields.join(', ');
    case 'forbidden-definition-unavailable': return '전체 금지 패턴 설정이 보고서에 없어 동일한 검사 정의인지 확인할 수 없습니다.';
    case 'project-name-different': return '프로젝트 이름이 달라 직접 대응을 확정하지 않았습니다.';
    case 'tool-different': return '도구 이름 또는 버전이 다릅니다.';
  }
}
export const scoreReasons: Record<ScoreRestriction, string> = {
  'incomparable-checks': '직접 비교할 수 없는 검사가 있습니다.', 'membership-changed': '검사 항목이 추가되거나 제거되었습니다.',
  'order-changed': '공통 검사의 순서가 달라졌습니다.', 'no-checks': '한쪽 이상의 검사 목록이 비어 있습니다.',
  'context-different': '프로젝트 또는 도구 정보가 다릅니다.', 'incomplete-score': '한쪽 이상의 점수가 불완전합니다 (scoreComplete=false).',
  'null-score': '한쪽 이상의 점수가 없습니다 (null).'
};
