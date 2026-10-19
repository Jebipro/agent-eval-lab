# Agent Eval Lab

Evaluate a local project's tests, type checks, explicit requirements commands, and Git changes after an AI coding agent or a person edits it.

**v0.1.0 is published on npm:** [agent-eval-lab](https://www.npmjs.com/package/agent-eval-lab). See the [npm release report](docs/NPM_RELEASE_REPORT.md) for the published artifact, registry installation checks, and remaining verification limits.

## Quick Start

Run these commands in the project you want to evaluate. You do not need to clone or build Agent Eval Lab:

```sh
npx agent-eval-lab init
npx agent-eval-lab run
```

Run from the project to evaluate. Prerequisites: Node.js **22.12+** and npm; install that project's own dependencies first. Auto-setup supports npm, TypeScript, and Vitest. Git is optional during setup. No API key, model API, or agent execution is involved.

`init` shows detected evidence and suggested commands before asking for acceptance. `init --yes` accepts safe defaults. It never executes checks or installs dependencies. Add `.agent-eval/` to your project's `.gitignore`.

An actual run of the included small fixture produced this output (timings vary):

```text
Agent Eval Lab — small-project

PASS    Tests  1.65s [exit 0]
PASS    Typecheck  1.44s [exit 0]

Git: disabled
Forbidden files gate: disabled
Score: 100 / 100 (2 / 2 checks passed)
Failed: 0; errors: 0; skipped: 0
Result: PASSED (exit 0)
```

## Configuration

`agent-eval.yaml` is validated strictly. Unknown fields and duplicate or reserved ids are errors. A command is an executable plus an array of arguments, not a shell string. Wrap complex commands in a project package script.

```yaml
version: 1
name: my-project
checks:
  - id: tests
    label: Tests
    kind: command
    command: npm
    args: [run, test, --, --run]
    required: true
    timeoutMs: 120000
  - id: typecheck
    kind: command
    command: npm
    args: [run, typecheck]
  - id: requirements
    kind: command
    command: npm
    args: [run, "check:requirements"]
git:
  enabled: true
  base: HEAD
  forbidden: [".env", "**/.env", ".env.*", "**/.env.*"]
report:
  path: .agent-eval/report.json
```

Only include scripts that your project actually defines. `checks` must contain at least one command. `label` defaults to its id, `args` to `[]`, `required` to true, and `timeoutMs` to 120000. Timeout is a positive finite integer; long deadlines are scheduled in chunks to avoid Node timer overflow. `git` defaults to disabled; when enabled, base defaults to HEAD and forbidden to `[]`. `report.path` defaults to `.agent-eval/report.json`. `forbidden-files` and `git-changes` are reserved ids.

Auto-detection reads package manifests, lockfiles, tsconfig JSONC, installed tool paths, and representative config filenames; it never imports project config modules. Existing npm scripts take precedence. Plain `vitest` becomes `npm run test -- --run`; `vitest run` is preserved. Placeholder tests, watch commands, and ambiguous Vitest shell scripts are not suggested. Local TypeScript can be proposed with `--noEmit` when no typecheck script exists. Missing dependencies are explained, never installed. pnpm/yarn or conflicting lockfiles require explicit configuration; automatic execution support is only claimed for npm.

If nothing is detected, interactive setup accepts an executable and a JSON argument array. Input-free setup fails with guidance. An existing configuration requires `init --force` to replace it. In a TTY, `run` without a config offers setup; input-free `run` does not create a config.

## CLI and exit codes

```text
agent-eval-lab init [directory] [--yes] [--force] [--non-interactive]
agent-eval-lab run [directory] [--config <path>] [--base <ref>]
                   [--report <path>] [--json] [--non-interactive]
agent-eval-lab --help
agent-eval-lab --version
```

The directory defaults to cwd. Relative config and report paths are resolved from the **evaluated project root**, including when called from elsewhere. Absolute paths are accepted. `--base` and `--report` override only that run. `--json` writes one JSON document to stdout; child logs never stream to stdout. Runs with a valid root and configuration save the same result to the report file. Initialization, argument, missing-root, and configuration errors leave existing reports and directories unchanged and return their error envelope on stdout.

`--non-interactive`, `CI=true`, `--json`, or either stdin/stdout being non-TTY disable prompts. `--yes` only accepts valid init defaults, never bypasses validation.

| Exit | Meaning |
| --- | --- |
| 0 | All required checks pass, or init/help/version succeeds |
| 1 | A required check failed |
| 2 | Config/environment error, execution error, timeout, required skipped check, Git error, or report write error |
| 130 | SIGINT cancellation |

Errors take precedence over check failures. Optional failures are visible and lower the score without causing exit 1. Optional execution errors still cause exit 2.

## Meaning of the results

Commands run sequentially in the project root. A failing check does not prevent independent checks from running. A normal nonzero command exit is `fail`; an unavailable executable, timeout, or unexpected signal is `error`. Cancellation marks unexecuted checks `skipped` with reasons.

Score is `round(100 × passed / configured scored checks)`. Every command and an active forbidden-files gate has equal weight, including optional checks. Error/skipped checks stay in the denominator and mark the score incomplete. Setup errors have a null score. Git statistics receive no score. Tests are reported by command exit status; no test counts are inferred from console text.

Passing provides evidence for configured checks only. It does not guarantee all requirements, security, general code quality, or agent ability. Different configurations are not comparable agent rankings. Existing tests support regression prevention; this tool does not compare baseline test results or invent a separate regression check. Requirements need an explicit executable check such as the [example](examples/requirements.yaml).

## Git scope and forbidden files

The base is resolved to a commit SHA at the start. A **before-commands** snapshot compares the current working tree to that SHA, combining staged and unstaged final content, plus non-ignored untracked files. A staged edit undone in the working tree is not double-counted. Evaluation is restricted to the specified project subtree even in a larger repository.

`.git`, `node_modules`, `.agent-eval`, and the actual report output path are excluded. The config is an ordinary change. Renames preserve old/new paths and count once. Both paths are checked, including additions, deletions, and modifications. Binary/untracked line counts are null; totals explicitly indicate incompleteness. Git output is NUL-delimited to preserve spaces, Unicode, and tabs where the OS allows them.

In-scope `assume-unchanged` or `skip-worktree` index flags cause an explicit Git error: changes hidden by these flags cannot be certified. The tool never clears the flags or changes the index. Restored index-deleted files use Git's text/autocrlf/eol normalization; custom clean filters and working-tree encodings in that exceptional comparison cause an explicit error instead of executing a filter or guessing the result.

Glob matching uses [minimatch](https://github.com/isaacs/minimatch) with `dot: true`, case-sensitive POSIX `/` paths, `nonegate`, `nocomment`, and `noext`. The accepted dialect is `*`, `**`, `?`, `[]`, `{a,b}`; no absolute paths, `..`, backslashes, negation, extglobs, control characters, or unbalanced brackets. `.env.*` includes `.env.example`; adjust rules if allowed. A nonempty forbidden list with Git enabled creates a required gate. Otherwise no PASS is manufactured. Lockfiles are forbidden only in the [task-specific example](examples/no-dependency-changes.yaml).

Ignored untracked `.env` files are outside the scan. This is not a secret scanner or leak-prevention tool. Git commands are read-only. Default HEAD is useful for uncommitted edits; committed PR changes require `--base <base-SHA>` and sufficient fetched history. No checkout/reset/stash is performed. Concurrent edits during Git snapshot collection are not an atomic repository snapshot.

## Reports and troubleshooting

The default output is `.agent-eval/report.json`; see the [report contract](docs/report-schema.md), [JSON Schema](docs/report.schema.json), and [real fixture reports](examples/reports). Directories are created and writes use a temporary file followed by rename. Existing non-report files and symlink targets are protected. JSON reports are data for a future viewer; no server, HTML viewer, or hosting is included.

For example, a successful two-check report contains this subset (the linked fixture reports contain the complete schema):

```json
{
  "schemaVersion": 1,
  "status": "passed",
  "exitCode": 0,
  "score": 100,
  "scoreComplete": true,
  "summary": { "pass": 2, "fail": 0, "error": 0, "skipped": 0, "required": 2, "optional": 0, "total": 2, "optionalFailures": 0 }
}
```

| Problem | Next action |
| --- | --- |
| Tests/typecheck fail | Re-run the displayed command in the project and fix the reported problem |
| Config missing/invalid | Run `init --yes` or correct the reported field path; inspect `--help` |
| Dependencies missing | Install the target project's dependencies yourself, then retry init |
| Timeout | Ensure single-run mode; inspect a stuck command or deliberately adjust timeout |
| Base unavailable | Fetch the commit/ref or supply an existing `--base`; disable Git only if the task permits |
| Report write fails | Choose a writable `.json` path that is not a source/config file |

Only run trusted YAML and package scripts: this is **not a sandbox**. Commands inherit your environment, but environment values and full source/diffs are not dumped. Captured output is limited to 64 KiB per stream, can contain sensitive values or paths, and should be reviewed before sharing. Terminal text removes ANSI control sequences. On timeout/cancellation, POSIX uses a process group kill; Windows uses `taskkill /T /F`. Deliberately detached/reparented processes or permission boundaries may escape cleanup. On Windows some characters (including tabs) cannot be filesystem filenames; those tests are Linux-only.

Windows npm.cmd is resolved to its installed npm-cli.js and run with Node so arguments bypass the batch shim. Unrecognized npm shims and metacharacter arguments to other batch files are rejected; configure a native executable/JS entry explicitly in those cases. Cleanup uses the absolute SystemRoot taskkill path, bounded waits, and a direct-child kill fallback. Failed tree cleanup is reported as an error even when the direct child exits; unconfirmed termination is never described as successful cleanup. Cancellation still returns overall exit 130, with cleanup errors retained in the check reason. An unconfirmed tree may require manual cleanup.

## GitHub Actions for consumers

```yaml
name: Evaluate
on: [pull_request]
permissions:
  contents: read
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx --yes agent-eval-lab run --non-interactive --base "${{ github.event.pull_request.base.sha }}" --report .agent-eval/report.json
      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        if: always()
        with:
          name: agent-eval-report
          path: .agent-eval/report.json
          include-hidden-files: true
```

Commit a reviewed `agent-eval.yaml` before running this workflow. npm's `npx --yes` accepts package installation; the tool's `--non-interactive` disables its prompts. Pin an actually verified exact package version (`agent-eval-lab@<verified-version>`) for reproducibility. Failures remain failures; artifact upload runs even when evaluation fails. No commenting token or deployment is required.

## Development and contribution

Clone `https://github.com/Jebipro/agent-eval-lab.git`, or use this source folder. Then:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
npm run test:package
```

`npm test` is non-watch Vitest. Unit tests can run with `npm run test:unit` without a network or a fresh install. Integration tests use the already installed development tools in temporary fixtures. `test:package` packs the current source, installs the exact tarball outside the repository with `--omit=dev`, installs independent fixture dependencies, and runs the installed bin. A configured npm registry or warm cache is needed for installation. It does not use bare npx or a source runner. It verifies exit 0/1/2, schema, JSON-only stdout, and the prepared-fixture two-minute target. [Recorded package verification](docs/package-verification.json) separates dependency/install times from init/run time; first cold registry download is not measured.

Run `npm run examples` to regenerate example reports from real temporary fixtures with machine-specific paths redacted. **Actual GitHub Actions verification passed on Windows and Ubuntu with Node 22.23.3 and 24.21.0:** Windows 89 passed / 2 OS skips; Ubuntu 81 passed / 10 OS skips. All four jobs also passed strict typecheck, build, pack, and external consumer installation/CLI checks. See [commit-specific CI evidence and limitations](docs/GITHUB_RELEASE_READINESS.md). The [remediation verification](docs/REMEDIATION_REPORT.md) and [initial verification](docs/verification.md) preserve historical local results. Contributions should add a focused test for changed user-visible behavior and keep fixtures outside the tool's TypeScript build.

See [architecture](docs/architecture.md) and [release procedure](docs/release.md). MIT licensed. v0.1 excludes agent orchestration, LLM judging, baseline-report comparison, automatic dependency installation/code modification, SaaS, and web UI. A GitHub Pages viewer consuming this JSON is a future possibility only.

### Test a local package

The release verification produces `agent-eval-lab-0.1.0.tgz`. In a separate consumer directory, use its **absolute path**:

```sh
npm install --omit=dev /absolute/path/to/agent-eval-lab-0.1.0.tgz
./node_modules/.bin/agent-eval-lab --help
./node_modules/.bin/agent-eval-lab init /absolute/path/to/prepared-project --yes
./node_modules/.bin/agent-eval-lab run /absolute/path/to/prepared-project --non-interactive
```

PowerShell uses `& .\node_modules\.bin\agent-eval-lab.cmd ...`. Quote paths containing spaces. This installation uses compiled JavaScript and runtime dependencies; consumers do not install TypeScript to build this tool. An evaluated TypeScript project still needs its own compiler.
