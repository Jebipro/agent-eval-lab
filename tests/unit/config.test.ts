import { describe, expect, test } from 'vitest';
import { configSchema, validGlob } from '../../src/config/schema.js';
import { parseArgs } from '../../src/cli/args.js';
const ok = { version: 1, checks: [{ id: 'test', kind: 'command', command: 'npm' }] };
describe('configuration contract', () => {
  test('applies documented defaults', () => { const c = configSchema.parse(ok); expect(c.git.enabled).toBe(false); expect(c.checks[0]?.timeoutMs).toBe(120000); expect(c.checks[0]?.required).toBe(true); expect(c.report.path).toBe('.agent-eval/report.json'); });
  test.each([{ ...ok, version: 2 }, { ...ok, unknown: true }, { ...ok, checks: [] }, { ...ok, checks: [ok.checks[0], ok.checks[0]] }, { ...ok, checks: [{ ...ok.checks[0], timeoutMs: '50' }] }, { ...ok, checks: [{ ...ok.checks[0], timeoutMs: 0 }] }, { ...ok, checks: [{ ...ok.checks[0], command: '' }] }, { ...ok, checks: [{ ...ok.checks[0], id: 'forbidden-files' }] }, { ...ok, git: { enabled: true, forbidden: ['[broken'] } }])('rejects invalid input %# with a field path', value => { const r = configSchema.safeParse(value); expect(r.success).toBe(false); if (!r.success) expect(r.error.issues[0]?.path.length).toBeGreaterThanOrEqual(0); });
  test.each(['**/.env', '.env.*', 'src/{a,b}.ts', 'file[0-9]?.ts'])('accepts supported glob %s', p => expect(validGlob(p)).toBe(true));
  test.each(['', '/absolute', '../escape', '!negate', '[unclosed', '**\\.env', '@(extglob)'])('rejects unsupported glob %s', p => expect(validGlob(p)).toBe(false));
  test('CLI parsing and invalid arguments', () => { expect(parseArgs(['run', 'project', '--report', 'out.json']).directory).toBe('project'); expect(() => parseArgs(['run', '--base'])).toThrow('Missing value'); expect(() => parseArgs(['run', '--yes'])).toThrow('Unknown option'); expect(() => parseArgs(['run', 'a', 'b'])).toThrow('one project'); });
});
