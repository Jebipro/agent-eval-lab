# Reproducing the scenarios

Run `npm ci` in the tool source, then `npm run examples`. It copies `fixtures/small-project` into a temporary directory, uses already installed development tools, and records real CLI output in `reports/`. The original fixture remains successful. No external services/model APIs are used. Temporary Git identity is passed only on fixture commit commands.

| Report | Change | Expected exit |
| --- | --- | --- |
| success-no-git | Original TypeScript/Vitest/npm fixture, Git disabled | 0 |
| test-failure | Replace addition with subtraction; real assertion fails | 1 |
| type-error | Return string from numeric function; real tsc error | 1 |
| forbidden-file | Modify tracked `.env.example` after temporary baseline | 1 |
| execution-error | Nonexistent executable | 2 |
| timeout | Long-running Node command with 100ms timeout | 2 |
| requirements | Explicit npm check:requirements script | 0 |

`requirements.yaml` can be copied to a prepared small-project as `agent-eval.yaml`. It checks an explicit public export requirement; no natural-language requirements are inferred. `no-dependency-changes.yaml` forbids package/lock changes only for tasks that require it. Terminal output is captured in `terminal.txt`. In both terminal text and JSON strings, native and slash-normalized fixture/source paths are replaced with `<project>`/`<source>` for publication. Results, exit codes and scores remain actual observations. Review other captured output before sharing; this substitution is not a general secret scanner.

For independent consumer validation, use `npm run test:package`; unlike these example runs, it installs a real tarball and separate fixture dependencies outside the repository.
