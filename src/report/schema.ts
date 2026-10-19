import { z } from 'zod';
// Browser-safe validation contract; no Node imports or execution.
const diagnostic = z.object({ code: z.string(), message: z.string(), hint: z.string() }).strict();
const count = z.number().int().nonnegative();
const check = z.object({
  id: z.string(), label: z.string(), kind: z.enum(['command', 'forbidden']), required: z.boolean(),
  status: z.enum(['pass', 'fail', 'error', 'skipped']), durationMs: count, exitCode: z.number().int().nullable(), reason: z.string().nullable(),
  command: z.string().optional(), args: z.array(z.string()).optional(), timedOut: z.boolean().optional(), signal: z.string().nullable().optional(),
  stdout: z.string().optional(), stderr: z.string().optional(), outputTruncated: z.boolean().optional(),
  violations: z.array(z.object({ path: z.string(), pattern: z.string() }).strict()).optional()
}).strict();
export const reportSchema = z.object({
  schemaVersion: z.literal(1), tool: z.object({ name: z.literal('agent-eval-lab'), version: z.string() }).strict(),
  run: z.object({ id: z.uuid(), startedAt: z.iso.datetime(), endedAt: z.iso.datetime(), durationMs: count }).strict(),
  project: z.object({ name: z.string() }).strict(), status: z.enum(['passed', 'failed', 'error', 'cancelled']), exitCode: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(130)]),
  score: z.number().int().min(0).max(100).nullable(), scoreComplete: z.boolean(),
  summary: z.object({ pass: count, fail: count, error: count, skipped: count, required: count, optional: count, total: count, optionalFailures: count }).strict(),
  checks: z.array(check),
  git: z.object({ enabled: z.boolean(), baseRef: z.string().nullable(), baseSha: z.string().nullable(), capturedAt: z.iso.datetime(), timing: z.literal('before-commands'),
    changes: z.array(z.object({ path: z.string(), oldPath: z.string().nullable(), status: z.string(), additions: count.nullable(), deletions: count.nullable(), binary: z.boolean() }).strict()),
    stats: z.object({ files: count, additions: count, deletions: count, incomplete: z.boolean() }).strict()
  }).strict().nullable(), warnings: z.array(diagnostic), errors: z.array(diagnostic)
}).strict();
