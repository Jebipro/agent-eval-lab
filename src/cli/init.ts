import { access, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { stringify } from 'yaml';
import { detect } from '../detect/index.js';
import { configSchema } from '../config/schema.js';

export interface InitOptions { yes: boolean; force: boolean; interactive: boolean }
export type Ask = (prompt: string) => Promise<string>;
export async function initialize(root: string, options: InitOptions, ask: Ask, log: (s: string) => void): Promise<void> {
  const path = join(root, 'agent-eval.yaml');
  const present = await access(path).then(() => true, () => false);
  if (present && !options.force) throw new Error(`Config already exists: ${path}. Review it or use init --force to replace it.`);
  const detected = await detect(root);
  for (const line of detected.evidence) log(`Detected: ${line}`);
  for (const line of detected.warnings) log(`Note: ${line}`);
  let config = detected.config;
  if (!config) {
    if (!options.interactive || options.yes) throw new Error('No safe checks detected. Prepare dependencies or write explicit checks in agent-eval.yaml; interactive init can accept executable and JSON args.');
    const command = await ask('Check executable (e.g. npm): ');
    const args: unknown = JSON.parse(await ask('Arguments as a JSON array (e.g. ["run","test"]): '));
    config = configSchema.parse({ version: 1, name: basename(root), checks: [{ id: 'custom', kind: 'command', command, args }], git: { enabled: false } });
  }
  for (const check of config.checks) log(`${check.label ?? check.id}: ${[check.command, ...check.args].map(x => JSON.stringify(x)).join(' ')}`);
  log(`${present ? 'Replace' : 'Create'} ${path}${present ? ' (all previous configuration fields will be replaced by these detected defaults)' : ''}`);
  if (!options.yes) {
    if (!options.interactive) throw new Error('Input disabled. Use init --yes to accept the detected defaults.');
    if (!/^(?:y|yes)?$/i.test((await ask('Accept this configuration? [Y/n] ')).trim())) throw new Error('Initialization declined; no configuration written.');
  }
  await writeFile(path, '# Trusted local commands only. Paths are relative to this project.\n# .env.* also matches .env.example; adjust forbidden rules for your task.\n' + stringify(config), { flag: options.force ? 'w' : 'wx' });
  log('Created agent-eval.yaml\nAdd .agent-eval/ to .gitignore.\nNext: npx agent-eval-lab run');
}
