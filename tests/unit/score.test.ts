import { expect, test } from 'vitest';
import { emptyReport, finalize } from '../../src/core/evaluate.js';
import type { CheckResult } from '../../src/report/types.js';
function check(status: CheckResult['status'], required = true): CheckResult { return { id: status, label: status, kind: 'command', status, required, durationMs: 0, exitCode: null, reason: status === 'skipped' ? 'Not executed' : null }; }
test('rounding and optional checks remain in denominator', () => { const r = emptyReport('x'); r.checks = [check('pass'), check('pass'), check('fail', false)]; finalize(r); expect(r.score).toBe(67); expect(r.exitCode).toBe(0); expect(r.summary.optionalFailures).toBe(1); });
test('required failure, error precedence, skipped, cancellation', () => { const r = emptyReport('x'); r.checks = [check('fail'), check('pass')]; expect(finalize(r).exitCode).toBe(1); r.checks.push(check('error', false)); expect(finalize(r).exitCode).toBe(2); expect(r.scoreComplete).toBe(false); r.checks = [check('skipped')]; expect(finalize(r).exitCode).toBe(2); expect(finalize(r, true).exitCode).toBe(130); });
test('initial error envelope has no manufactured score', () => { const r = emptyReport('x'); expect(r.score).toBeNull(); expect(r.git).toBeNull(); expect(r.checks).toEqual([]); expect(r.exitCode).toBe(2); });
