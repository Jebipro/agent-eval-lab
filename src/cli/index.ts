#!/usr/bin/env node
import { resolve, basename, join } from 'node:path';
import { access, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { parseArgs, HELP } from './args.js';
import { initialize } from './init.js';
import { loadConfig } from '../config/load.js';
import { emptyReport, evaluate, VERSION } from '../core/evaluate.js';
import { saveReport, validateReportPath } from '../report/save.js';
import { serialize } from '../report/serialize.js';
import { terminal } from '../report/terminal.js';

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let json = argv.includes('--json');
  let root = process.cwd(), configPath = join(root, 'agent-eval.yaml'), reportPath = join(root, '.agent-eval/report.json');
  let report = emptyReport(basename(root));
  let saveEligible = false;
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  let rl: ReturnType<typeof createInterface> | undefined;
  // Line-oriented prompts do not need raw terminal mode (restricted Windows
  // consoles can reject setRawMode even when isTTY is true).
  const ask = (prompt: string) => { rl ??= createInterface({ input: process.stdin, output: process.stderr, terminal: false }); return rl.question(prompt, { signal: controller.signal }); };
  const log = (line: string) => process.stderr.write(line + '\n');
  try {
    const args = parseArgs(argv); json = args.json;
    if (args.action === 'help') { process.stdout.write(HELP); return 0; }
    if (args.action === 'version') { process.stdout.write(VERSION + '\n'); return 0; }
    root = resolve(args.directory); configPath = resolve(root, args.config ?? 'agent-eval.yaml'); reportPath = resolve(root, args.report ?? '.agent-eval/report.json');
    report = emptyReport(basename(root));
    if (!(await stat(root)).isDirectory()) throw new Error(`Project root is not a directory: ${root}`);
    const interactive = !args.nonInteractive && !json && process.env.CI?.toLowerCase() !== 'true' && Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (args.action === 'init') { await initialize(root, { yes: args.yes, force: args.force, interactive }, ask, log); return 0; }
    if (!await access(configPath).then(() => true, () => false)) {
      if (interactive && !args.config && /^(y|yes)$/i.test((await ask('No agent-eval.yaml found. Initialize now? [y/N] ')).trim())) await initialize(root, { yes: false, force: false, interactive }, ask, log);
      else throw new Error(`Config missing: ${configPath}. Run agent-eval-lab init ${JSON.stringify(root)} --yes, or supply --config <path>.`);
    }
    const config = await loadConfig(configPath);
    if (args.base) config.git.base = args.base;
    reportPath = resolve(root, args.report ?? config.report.path);
    saveEligible = true;
    await validateReportPath(reportPath, configPath);
    report = await evaluate(config, root, reportPath, controller.signal);
  } catch (error) {
    report.errors.push({ code: 'CONFIG_OR_ENVIRONMENT_ERROR', message: error instanceof Error ? error.message : String(error), hint: 'Check configuration and prerequisites. Example: agent-eval-lab init ./project --yes; agent-eval-lab run ./project --non-interactive. See --help.' });
    report.status = controller.signal.aborted ? 'cancelled' : 'error'; report.exitCode = controller.signal.aborted ? 130 : 2;
  } finally { rl?.close(); process.removeListener('SIGINT', interrupt); }
  report.run.endedAt = new Date().toISOString(); report.run.durationMs = Date.parse(report.run.endedAt) - Date.parse(report.run.startedAt);
  let saved = false;
  try { if (saveEligible) { await saveReport(reportPath, report, configPath); saved = true; } }
  catch (error) { report.errors.push({ code: 'REPORT_WRITE_ERROR', message: `Cannot save ${reportPath}: ${String(error)}`, hint: 'Choose a writable .json report path; existing non-report files are protected.' }); if (report.exitCode !== 130) { report.exitCode = 2; report.status = 'error'; } report.scoreComplete = false; }
  process.stdout.write(json ? serialize(report) : terminal(report, reportPath, saved));
  return report.exitCode;
}
process.exitCode = await main();
