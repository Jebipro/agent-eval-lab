import type { ReadonlyReport } from './types';

/** Display transformation only: preserve the validated report and never emit HTML. */
export function displayText(value: string, limit = 256): string {
  const bounded = value.slice(0, limit);
  return bounded.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + (value.length > limit ? '…' : '');
}
export function acceptanceView(report: ReadonlyReport): Readonly<{ projectName: string; schemaVersion: 1 }> {
  return { projectName: displayText(report.project.name), schemaVersion: report.schemaVersion };
}
