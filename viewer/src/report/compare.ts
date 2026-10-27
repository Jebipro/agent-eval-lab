import type { ReadonlyReport } from './types';

type Check = ReadonlyReport['checks'][number];
export interface CheckReference { readonly index: number; readonly check: Check }
export type DefinitionField = 'label' | 'kind' | 'required' | 'command' | 'args';
export type ComparisonReason =
  | { readonly code: 'duplicate-id' }
  | { readonly code: 'definition-changed'; readonly fields: readonly DefinitionField[] }
  | { readonly code: 'command-definition-missing'; readonly fields: readonly ('command' | 'args')[] }
  | { readonly code: 'forbidden-definition-unavailable' }
  | { readonly code: 'project-name-different' }
  | { readonly code: 'tool-different' };
export type CheckComparison =
  | { readonly type: 'status-changed' | 'status-unchanged'; readonly id: string; readonly before: CheckReference; readonly after: CheckReference; readonly basis: 'recorded-command-definition' }
  | { readonly type: 'before-only'; readonly id: string; readonly before: CheckReference }
  | { readonly type: 'after-only'; readonly id: string; readonly after: CheckReference }
  | { readonly type: 'incomparable'; readonly id: string; readonly before: readonly CheckReference[]; readonly after: readonly CheckReference[]; readonly reasons: readonly ComparisonReason[] };
export type ScoreRestriction = 'incomparable-checks' | 'membership-changed' | 'order-changed' | 'no-checks' | 'context-different' | 'incomplete-score' | 'null-score';
export interface ReportComparison {
  /** Borrowed readonly inputs: no clones, normalization, score repair or Git diff. */
  readonly before: ReadonlyReport;
  readonly after: ReadonlyReport;
  readonly checks: readonly CheckComparison[];
  readonly contextReasons: readonly ComparisonReason[];
  readonly orderChanged: boolean;
  readonly score: {
    readonly before: number | null; readonly after: number | null;
    readonly beforeComplete: boolean; readonly afterComplete: boolean;
    /** Arithmetic only, including when the numbers must not be ranked. */
    readonly rawDelta: number | null;
    readonly basis: 'recorded-comparable' | 'not-comparable';
    readonly restrictions: readonly ScoreRestriction[];
    readonly qualityJudgment: 'not-assessed';
  };
  readonly git: {
    readonly kind: 'independent-snapshots';
    readonly before: ReadonlyReport['git']; readonly after: ReadonlyReport['git'];
  };
}

function group(checks: ReadonlyReport['checks']): Map<string, CheckReference[]> {
  const groups = new Map<string, CheckReference[]>();
  checks.forEach((check, index) => {
    const bucket = groups.get(check.id);
    if (bucket) bucket.push({ check, index }); else groups.set(check.id, [{ check, index }]);
  });
  return groups;
}
function sameArgs(a: Check['args'], b: Check['args']): boolean {
  return a === undefined || b === undefined ? a === b : a.length === b.length && a.every((arg, i) => arg === b[i]);
}
function definitionReasons(a: Check, b: Check): ComparisonReason[] {
  const fields: DefinitionField[] = [];
  for (const key of ['label', 'kind', 'required', 'command'] as const) if (a[key] !== b[key]) fields.push(key);
  if (!sameArgs(a.args, b.args)) fields.push('args');
  const reasons: ComparisonReason[] = fields.length ? [{ code: 'definition-changed', fields }] : [];
  if (a.kind === 'forbidden' || b.kind === 'forbidden') reasons.push({ code: 'forbidden-definition-unavailable' });
  if (a.kind === 'command' || b.kind === 'command') {
    const missing: ('command' | 'args')[] = [];
    if (a.command === undefined || b.command === undefined || !a.command.trim() || !b.command.trim()) missing.push('command');
    if (a.args === undefined || b.args === undefined) missing.push('args');
    if (missing.length) reasons.push({ code: 'command-definition-missing', fields: missing });
  }
  return reasons;
}

/**
 * Accepts two already schema-v1-validated reports, in caller-supplied before/after order.
 * Equal recorded fields do not prove identical source, environment, timeout or project identity.
 * Result fields (logs, duration, exitCode, timedOut, signal, violations) are not definitions.
 * Never infer chronology from run IDs/timestamps or infer Git/code changes between snapshots.
 */
export function compareReports(before: ReadonlyReport, after: ReadonlyReport): ReportComparison {
  const old = group(before.checks), next = group(after.checks);
  const contextReasons: ComparisonReason[] = [];
  if (before.project.name !== after.project.name) contextReasons.push({ code: 'project-name-different' });
  if (before.tool.name !== after.tool.name || before.tool.version !== after.tool.version) contextReasons.push({ code: 'tool-different' });
  const rows: CheckComparison[] = [];
  // First occurrence in before, then IDs only in after. No positional or fuzzy pairing.
  for (const id of new Set([...old.keys(), ...next.keys()])) {
    const left = old.get(id) ?? [], right = next.get(id) ?? [];
    if (left.length > 1 || right.length > 1) {
      rows.push({ type: 'incomparable', id, before: left, after: right, reasons: [{ code: 'duplicate-id' }] });
    } else if (!right.length) rows.push({ type: 'before-only', id, before: left[0]! });
    else if (!left.length) rows.push({ type: 'after-only', id, after: right[0]! });
    else {
      const reasons = [...contextReasons, ...definitionReasons(left[0]!.check, right[0]!.check)];
      if (reasons.length) rows.push({ type: 'incomparable', id, before: left, after: right, reasons });
      else rows.push({ type: left[0]!.check.status === right[0]!.check.status ? 'status-unchanged' : 'status-changed',
        id, before: left[0]!, after: right[0]!, basis: 'recorded-command-definition' });
    }
  }
  // Relative order only for unambiguous IDs shared by both reports; additions are separate.
  const uniqueShared = (id: string) => old.get(id)?.length === 1 && next.get(id)?.length === 1;
  const oldOrder = before.checks.filter(c => uniqueShared(c.id)).map(c => c.id);
  const nextOrder = after.checks.filter(c => uniqueShared(c.id)).map(c => c.id);
  const orderChanged = oldOrder.some((id, i) => id !== nextOrder[i]);
  const restrictions: ScoreRestriction[] = [];
  if (rows.some(r => r.type === 'incomparable')) restrictions.push('incomparable-checks');
  if (rows.some(r => r.type === 'before-only' || r.type === 'after-only')) restrictions.push('membership-changed');
  if (orderChanged) restrictions.push('order-changed');
  if (!before.checks.length || !after.checks.length) restrictions.push('no-checks');
  if (contextReasons.length) restrictions.push('context-different');
  if (!before.scoreComplete || !after.scoreComplete) restrictions.push('incomplete-score');
  if (before.score === null || after.score === null) restrictions.push('null-score');
  return { before, after, checks: rows, contextReasons, orderChanged,
    score: { before: before.score, after: after.score, beforeComplete: before.scoreComplete, afterComplete: after.scoreComplete,
      rawDelta: before.score === null || after.score === null ? null : after.score - before.score,
      basis: restrictions.length ? 'not-comparable' : 'recorded-comparable', restrictions, qualityJudgment: 'not-assessed' },
    git: { kind: 'independent-snapshots', before: before.git, after: after.git } };
}
