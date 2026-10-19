import { z } from 'zod';
import { Minimatch } from 'minimatch';

// A deliberately small glob dialect: *, **, ?, [], {}. No negation/extglobs.
export function validGlob(pattern: string): boolean {
  if (!pattern || pattern.startsWith('/') || pattern.startsWith('!') || /[\\\x00-\x1f]/.test(pattern) || /^[A-Za-z]:/.test(pattern) || pattern.split('/').includes('..') || /[!+?*@]\(/.test(pattern)) return false;
  const stack: string[] = [];
  for (const c of pattern) {
    if (c === '[' || c === '{') stack.push(c);
    if (c === ']' || c === '}') { if (stack.pop() !== (c === ']' ? '[' : '{')) return false; }
  }
  return stack.length === 0 && new Minimatch(pattern, { dot: true, nonegate: true, nocomment: true, noext: true }).makeRe() !== false;
}
const nonempty = z.string().trim().min(1).refine(s => !s.includes('\0'), 'NUL characters are not allowed');
export const commandSchema = z.object({
  id: nonempty.refine(id => !['forbidden-files', 'git-changes'].includes(id), 'Reserved Git check id'),
  label: nonempty.optional(), kind: z.literal('command'), command: nonempty,
  args: z.array(z.string().refine(s => !s.includes('\0'), 'NUL characters are not allowed')).default([]), required: z.boolean().default(true),
  timeoutMs: z.number().positive().refine(Number.isInteger, 'Expected a positive finite integer').default(120000)
}).strict();
export const configSchema = z.object({
  version: z.literal(1), name: nonempty.optional(), checks: z.array(commandSchema).min(1),
  git: z.object({ enabled: z.boolean().default(false), base: nonempty.default('HEAD'), forbidden: z.array(z.string().refine(validGlob, 'Invalid relative glob (use *, **, ?, [], {})')).default([]) }).strict().default({ enabled: false, base: 'HEAD', forbidden: [] }),
  report: z.object({ path: nonempty.default('.agent-eval/report.json') }).strict().default({ path: '.agent-eval/report.json' })
}).strict().superRefine((config, ctx) => {
  const seen = new Set<string>();
  config.checks.forEach((check, i) => { if (seen.has(check.id)) ctx.addIssue({ code: 'custom', path: ['checks', i, 'id'], message: 'Duplicate id' }); seen.add(check.id); });
});
export type Config = z.infer<typeof configSchema>;
export type CommandCheck = z.infer<typeof commandSchema>;
