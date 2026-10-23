import type { ReadonlyReport } from '../report/types';
import { booleanText, Field, Status, TextValue } from './Fields';

export function Overview({ report: r }: { report: ReadonlyReport }) {
  return <section id="overview" aria-labelledby="overview-title" className="panel">
    <h2 id="overview-title">Overview · 평가 개요</h2>
    <dl className="metrics">
      <Field label="프로젝트명"><TextValue value={r.project.name} /></Field>
      <Field label="도구"><TextValue value={r.tool.name} /> · <TextValue value={r.tool.version} /></Field>
      <Field label="전체 평가 상태"><Status value={r.status} /></Field>
      <Field label="실제 종료 코드">{r.exitCode}</Field>
      <Field label="점수"><strong>{r.score === null ? '산정되지 않음 (null)' : `${r.score}점`}</strong></Field>
      <Field label="점수 완전성">{r.scoreComplete ? '완전한 점수 (scoreComplete=true)' : '불완전 점수 (scoreComplete=false)'}</Field>
      <Field label="검사 통과 / 전체">{r.summary.pass} / {r.summary.total}</Field>
      <Field label="실패 / 오류 / 건너뜀">{r.summary.fail} / {r.summary.error} / {r.summary.skipped}</Field>
      <Field label="필수 / 선택">{r.summary.required} / {r.summary.optional}</Field>
      <Field label="선택 검사 실패">{r.summary.optionalFailures}</Field>
    </dl>
    <dl>
      <Field label="run ID"><TextValue value={r.run.id} /></Field>
      <Field label="시작 시각 (원본 ISO)"><TextValue value={r.run.startedAt} /></Field>
      <Field label="종료 시각 (원본 ISO)"><TextValue value={r.run.endedAt} /></Field>
      <Field label="실행 시간">{r.run.durationMs} ms</Field>
    </dl>
    <p>점수는 설정된 명령 검사와 활성화된 금지 파일 검사 중 통과 비율입니다. 선택 검사도 포함됩니다. 검사 수는 Vitest 개별 테스트 수가 아닙니다.</p>
    <p>프로젝트 전체 품질·보안을 보증하지 않으며 서로 다른 검사 구성의 점수를 직접 비교하거나 순위화할 수 없습니다. 기록된 값은 재계산하지 않습니다.</p>
    <p className="hint">schemaVersion {r.schemaVersion} · 원본 scoreComplete: {booleanText(r.scoreComplete)}. ISO 시각의 Z는 UTC이며 원본의 시간대 표기를 보존합니다.</p>
  </section>;
}
