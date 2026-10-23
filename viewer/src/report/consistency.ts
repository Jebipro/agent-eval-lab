import type { ReadonlyReport } from './types';

/** Cross-field evidence only. Never infer score/status from checks or mutate the report. */
export function consistencyWarnings(report: ReadonlyReport): string[] {
  const warnings: string[] = [];
  const observed = { pass: 0, fail: 0, error: 0, skipped: 0, required: 0, optional: 0,
    total: report.checks.length, optionalFailures: 0 };
  const ids = new Set<string>();
  let duplicate = false;
  for (const check of report.checks) {
    observed[check.status]++;
    observed[check.required ? 'required' : 'optional']++;
    if (!check.required && check.status === 'fail') observed.optionalFailures++;
    if (ids.has(check.id)) duplicate = true;
    ids.add(check.id);
  }
  for (const key of Object.keys(observed) as (keyof typeof observed)[]) {
    if (report.summary[key] !== observed[key]) {
      warnings.push(`summary.${key} 기록 ${report.summary[key]}와 checks에서 확인한 ${observed[key]}가 다릅니다.`);
    }
  }
  if (duplicate) warnings.push('checks에 중복 id가 있습니다. 배열 순서대로 모든 검사를 표시합니다.');
  const codes = { passed: 0, failed: 1, error: 2, cancelled: 130 } as const;
  if (report.exitCode !== codes[report.status]) warnings.push('전체 status와 exitCode의 조합이 v1 계약 설명과 다릅니다.');
  return warnings;
}
