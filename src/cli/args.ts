export const HELP = `Agent Eval Lab — evaluate local command checks and Git changes

agent-eval-lab init [directory] [--yes] [--force] [--non-interactive]
agent-eval-lab run [directory] [--config <path>] [--base <ref>]
                   [--report <path>] [--json] [--non-interactive]
agent-eval-lab --help
agent-eval-lab --version

directory defaults to cwd. Relative --config and --report paths resolve from
the evaluated project root, not the caller's cwd. Default: agent-eval.yaml
and .agent-eval/report.json. --base and --report override only this run.
--json emits one JSON document and disables prompts. CI=true, non-TTY stdin
or stdout, and --non-interactive disable prompts too.
Exit codes: 0 passed, 1 required failure, 2 configuration/execution error,
130 SIGINT. Optional failures lower the score without causing exit 1.
Example: agent-eval-lab init ./my-project --yes
         agent-eval-lab run ./my-project --non-interactive
`;
export interface Args { action: 'init' | 'run' | 'help' | 'version'; directory: string; yes: boolean; force: boolean; nonInteractive: boolean; json: boolean; config?: string; report?: string; base?: string }
export function parseArgs(argv: string[]): Args {
  const out: Args = { action: 'help', directory: '.', yes: false, force: false, nonInteractive: false, json: argv.includes('--json') };
  if (!argv.length) return out;
  if (argv.length === 1 && ['--help', '-h', '--version', '-v'].includes(argv[0]!)) { out.action = argv[0] === '--version' || argv[0] === '-v' ? 'version' : 'help'; return out; }
  const action = argv[0]; if (action !== 'init' && action !== 'run') throw new Error(`Unknown command ${action}. Use agent-eval-lab --help.`);
  out.action = action; let directory = false;
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') { out.action = 'help'; continue; }
    if (arg === '--non-interactive') out.nonInteractive = true;
    else if (action === 'init' && arg === '--yes') out.yes = true;
    else if (action === 'init' && arg === '--force') out.force = true;
    else if (action === 'run' && arg === '--json') out.json = true;
    else if (action === 'run' && ['--config', '--report', '--base'].includes(arg)) {
      const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}. See agent-eval-lab run --help.`);
      out[arg.slice(2) as 'config' | 'report' | 'base'] = value;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}. See agent-eval-lab --help.`);
    else if (directory) throw new Error('Only one project directory is allowed. Example: agent-eval-lab run ./project');
    else { out.directory = arg; directory = true; }
  }
  return out;
}
