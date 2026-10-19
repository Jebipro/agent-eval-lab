import { readFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { configSchema, type Config } from '../config/schema.js';
import { resolveBase } from '../git/snapshot.js';

const exists = async (path: string) => access(path).then(() => true, () => false);
export interface Detection { config: Config | null; evidence: string[]; warnings: string[] }
export async function detect(root: string): Promise<Detection> {
  const evidence: string[] = [], warnings: string[] = [];
  let pkg: { name?: string; packageManager?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  if (await exists(join(root, 'package.json'))) {
    try { pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as typeof pkg; if (!pkg || typeof pkg !== 'object') throw new Error('Expected an object'); evidence.push('package.json found'); }
    catch (error) { throw new Error(`Invalid package.json: ${String(error)}`); }
  }
  const locks: string[] = [];
  for (const name of ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']) if (await exists(join(root, name))) locks.push(name);
  evidence.push(...locks.map(l => `Lockfile: ${l}`));
  for (const file of ['tsconfig.json', 'vitest.config.ts', 'vitest.config.js', 'vitest.config.mts', 'vite.config.ts']) if (await exists(join(root, file))) evidence.push(`Configuration file: ${file} (not executed)`);
  const unsupported = locks.some(l => l === 'pnpm-lock.yaml' || l === 'yarn.lock') || (pkg.packageManager && !pkg.packageManager.startsWith('npm@'));
  if (locks.length > 1) warnings.push('Multiple lockfiles found; resolve the conflict or supply explicit command checks.');
  if (unsupported) warnings.push('pnpm/yarn (or another package manager) detected. v0.1 auto-setup supports npm only; supply explicit commands.');
  const checks: unknown[] = [];
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const installed = !Object.keys(dependencies).length || await exists(join(root, 'node_modules'));
  if (!installed) warnings.push('Project dependencies are missing. Install them yourself (npm ci for an npm lockfile), then run init again.');
  const add = (id: string, label: string, command: string, args: string[]) => checks.push({ id, label, kind: 'command', command, args });
  const watch = (s: string) => /(?:--watch(?:\b|=)|\b(?:watch|dev|serve)\b|-w(?:\s|$))/.test(s);
  if (!unsupported && locks.length <= 1 && installed) {
    const test = pkg.scripts?.test;
    if (typeof test === 'string' && test.trim() && !/no test specified|Error: no test/i.test(test)) {
      if (/^vitest(?:\s+run)?$/.test(test.trim())) {
        if (await exists(join(root, 'node_modules/vitest/package.json'))) { add('tests', 'Tests', 'npm', test.trim() === 'vitest' ? ['run', 'test', '--', '--run'] : ['run', 'test']); evidence.push('Vitest test script; single-run mode'); }
        else warnings.push('Vitest script found but local Vitest is missing; install project dependencies.');
      } else if (watch(test) || (/\bvitest\b/.test(test) && !/\bvitest\s+run\b|--run\b/.test(test))) warnings.push('Test script may watch or contains complex Vitest syntax; provide an explicit single-run command.');
      else { add('tests', 'Tests', 'npm', ['run', 'test']); evidence.push('Existing npm test script'); }
    } else warnings.push('No usable test script (missing or placeholder).');
    const typecheck = pkg.scripts?.typecheck;
    if (typeof typecheck === 'string' && typecheck.trim() && !watch(typecheck)) { add('typecheck', 'Typecheck', 'npm', ['run', 'typecheck']); evidence.push('Existing npm typecheck script'); }
    else if (dependencies.typescript && await exists(join(root, 'tsconfig.json'))) {
      const errors: ParseError[] = [];
      const config: unknown = parseJsonc(await readFile(join(root, 'tsconfig.json'), 'utf8'), errors, { allowTrailingComma: true });
      if (!errors.length && config && typeof config === 'object' && !Array.isArray(config) && await exists(join(root, 'node_modules/typescript/bin/tsc'))) { add('typecheck', 'Typecheck', 'node', ['node_modules/typescript/bin/tsc', '--noEmit']); evidence.push('TypeScript dependency, readable tsconfig.json, installed local compiler'); }
      else warnings.push('TypeScript configuration is invalid or the local compiler is missing; supply a typecheck script after preparing dependencies.');
    }
  }
  let gitEnabled = false;
  try { await resolveBase(root, 'HEAD'); gitEnabled = true; evidence.push('Git HEAD commit available'); }
  catch { warnings.push('Git disabled: Git, repository, or HEAD commit unavailable.'); }
  if (!checks.length) return { config: null, evidence, warnings };
  return { config: configSchema.parse({ version: 1, name: typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name : basename(root), checks, git: { enabled: gitEnabled, base: 'HEAD', forbidden: gitEnabled ? ['.env', '**/.env', '.env.*', '**/.env.*'] : [] } }), evidence, warnings };
}
