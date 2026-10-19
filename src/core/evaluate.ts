import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { Config } from '../config/schema.js';
import type { Report, CheckResult } from '../report/types.js';
import { runCommand } from '../process/run.js';
import { snapshot, violations } from '../git/snapshot.js';

export const VERSION: string = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;
export function emptyReport(name: string): Report {
  const now = new Date().toISOString();
  return { schemaVersion: 1, tool: { name: 'agent-eval-lab', version: VERSION }, run: { id: randomUUID(), startedAt: now, endedAt: now, durationMs: 0 }, project: { name }, status: 'error', exitCode: 2, score: null, scoreComplete: false,
    summary: { pass: 0, fail: 0, error: 0, skipped: 0, required: 0, optional: 0, total: 0, optionalFailures: 0 }, checks: [], git: null, warnings: [], errors: [] };
}
export function finalize(report: Report, cancelled = false): Report {
  const checks = report.checks;
  report.summary = { pass: 0, fail: 0, error: 0, skipped: 0, required: 0, optional: 0, total: checks.length, optionalFailures: 0 };
  for (const c of checks) { report.summary[c.status]++; report.summary[c.required ? 'required' : 'optional']++; if (!c.required && c.status === 'fail') report.summary.optionalFailures++; }
  report.score = checks.length ? Math.round(100 * report.summary.pass / checks.length) : null;
  report.scoreComplete = checks.length > 0 && !report.summary.error && !report.summary.skipped && !report.errors.length;
  if (cancelled) { report.status = 'cancelled'; report.exitCode = 130; }
  else if (report.errors.length || checks.some(c => c.status === 'error' || (c.required && c.status === 'skipped'))) { report.status = 'error'; report.exitCode = 2; }
  else if (checks.some(c => c.required && c.status === 'fail')) { report.status = 'failed'; report.exitCode = 1; }
  else { report.status = 'passed'; report.exitCode = 0; }
  report.run.endedAt = new Date().toISOString(); report.run.durationMs = Date.parse(report.run.endedAt) - Date.parse(report.run.startedAt);
  return report;
}
export async function evaluate(config: Config, cwd: string, reportPath: string, signal?: AbortSignal): Promise<Report> {
  const report = emptyReport(config.name ?? basename(cwd));
  let gate: CheckResult | undefined;
  if (config.git.enabled) {
    if (config.git.forbidden.length) gate = { id: 'forbidden-files', label: 'Forbidden files', kind: 'forbidden', required: true, status: 'error', durationMs: 0, exitCode: null, reason: 'Git snapshot unavailable' };
    const started = Date.now();
    try {
      report.git = await snapshot(cwd, config.git.base, reportPath);
      if (gate) { const matches = violations(report.git.changes, config.git.forbidden); Object.assign(gate, { status: matches.length ? 'fail' : 'pass', reason: matches.length ? 'Forbidden paths changed; review changes or permitted rules.' : null, violations: matches }); }
    } catch (error) { report.errors.push({ code: 'GIT_ERROR', message: String(error), hint: 'Install Git and ensure this project is in a repository with the configured base commit; fetch the base if necessary.' }); }
    if (gate) gate.durationMs = Date.now() - started;
  } else report.git = { enabled: false, baseRef: null, baseSha: null, capturedAt: new Date().toISOString(), timing: 'before-commands', changes: [], stats: { files: 0, additions: 0, deletions: 0, incomplete: false } };
  for (const check of config.checks) report.checks.push(await runCommand(check, cwd, signal));
  if (gate) report.checks.push(gate);
  if (report.checks.some(c => !c.required && c.status === 'fail')) report.warnings.push({ code: 'OPTIONAL_FAILURE', message: 'Optional checks failed and reduced the score.', hint: 'Review their output even though they do not fail the required gate.' });
  return finalize(report, signal?.aborted);
}
