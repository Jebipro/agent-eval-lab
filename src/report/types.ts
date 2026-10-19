// Pure data contract: safe to import into a future browser viewer.
export type CheckStatus = 'pass' | 'fail' | 'error' | 'skipped';
export interface Diagnostic { code: string; message: string; hint: string }
export interface CheckResult {
  id: string; label: string; kind: 'command' | 'forbidden'; required: boolean;
  status: CheckStatus; durationMs: number; exitCode: number | null; reason: string | null;
  command?: string; args?: string[]; timedOut?: boolean; signal?: string | null;
  stdout?: string; stderr?: string; outputTruncated?: boolean;
  violations?: { path: string; pattern: string }[];
}
export interface GitChange {
  path: string; oldPath: string | null; status: string;
  additions: number | null; deletions: number | null; binary: boolean;
}
export interface GitSnapshot {
  enabled: boolean; baseRef: string | null; baseSha: string | null;
  capturedAt: string; timing: 'before-commands'; changes: GitChange[];
  stats: { files: number; additions: number; deletions: number; incomplete: boolean };
}
export interface Report {
  schemaVersion: 1; tool: { name: string; version: string };
  run: { id: string; startedAt: string; endedAt: string; durationMs: number };
  project: { name: string };
  status: 'passed' | 'failed' | 'error' | 'cancelled'; exitCode: 0 | 1 | 2 | 130;
  score: number | null; scoreComplete: boolean;
  summary: { pass: number; fail: number; error: number; skipped: number; required: number; optional: number; total: number; optionalFailures: number };
  checks: CheckResult[]; git: GitSnapshot | null;
  warnings: Diagnostic[]; errors: Diagnostic[];
}
