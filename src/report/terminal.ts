import type { Report } from './types.js';
// Strip control characters from untrusted child output used in a terminal.
const safe = (value: string) => value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
export function terminal(report: Report, reportPath: string, saved: boolean): string {
  const lines = [`Agent Eval Lab — ${report.project.name}`, ''];
  for (const c of report.checks) {
    lines.push(`${c.status.toUpperCase().padEnd(7)} ${c.label}  ${(c.durationMs / 1000).toFixed(2)}s${c.required ? '' : ' (optional)'}${c.kind === 'command' ? ` [exit ${c.exitCode ?? 'none'}]` : ''}`);
    if (c.reason) lines.push(`  ${c.reason}`);
    if (c.status !== 'pass' && c.command) { lines.push(`  Reproduce in project: ${[c.command, ...(c.args ?? [])].map(s => JSON.stringify(s)).join(' ')}`); if (c.stderr || c.stdout) lines.push(`  ${(c.stderr || c.stdout || '').slice(-2000)}`); }
    if (c.outputTruncated) lines.push('  Output truncated (64 KiB per stream).');
    for (const match of c.violations ?? []) lines.push(`  ${JSON.stringify(match.path)} matched ${JSON.stringify(match.pattern)}`);
  }
  if (report.git?.enabled) lines.push('', `Git base: ${report.git.baseRef} (${report.git.baseSha})`, `Changed files: ${report.git.stats.files} (snapshot before commands)`, `Tracked text lines: +${report.git.stats.additions} -${report.git.stats.deletions}${report.git.stats.incomplete ? ' (incomplete: binary/untracked counts unknown)' : ''}`);
  else lines.push('', report.git === null ? 'Git: unavailable / not started' : 'Git: disabled');
  if (!report.checks.some(c => c.id === 'forbidden-files')) lines.push('Forbidden files gate: disabled');
  lines.push(`Score: ${report.score ?? 'N/A'} / 100 (${report.summary.pass} / ${report.summary.total} checks passed)${report.scoreComplete ? '' : ' — incomplete'}`, `Failed: ${report.summary.fail}; errors: ${report.summary.error}; skipped: ${report.summary.skipped}`, `Result: ${report.status.toUpperCase()} (exit ${report.exitCode})`);
  for (const d of [...report.warnings, ...report.errors]) lines.push(`${d.code}: ${d.message}`, `Next: ${d.hint}`);
  lines.push(`${saved ? 'JSON report' : 'JSON report NOT saved'}: ${reportPath}`);
  return safe(lines.join('\n')) + '\n';
}
