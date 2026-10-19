# Agent Eval Lab v0.1 — 독립 Adversarial Code Review

감사 실행: 2026-10-18, 재개·근거 확인 및 보고서 완료: 2026-10-19 (Asia/Seoul).

**결론: 재현된 제품 결함 6건(High 2, Medium 4). 현재 상태의 npm 배포는 보류를 권고한다.** 일반 사용 흐름과 기존 테스트는 통과하지만, Windows 인자 처리에서 의도하지 않은 명령이 실행되고, 실제 금지 파일 변경을 누락해 PASS/100점을 반환하는 경우가 있다. 코드 열람 목적의 GitHub 공개와 검증된 릴리스 배포는 구분해야 한다.

이 보고서는 기존 구현자의 PASS 선언을 승인한 것이 아니다. 원본 요구사항, 실제 코드, 독립 실행 및 대조 실험을 기준으로 작성했다. 프로덕션 코드, 기존 테스트, 기존 검증 문서는 수정하지 않았다. 수정 권고는 모두 미적용 상태다.

## 1. 범위, 기준, 보존 상태

기준 명세는 사용자가 제공한 외부 `AGENT_EVAL_LAB_MASTER_PROMPT.md`다. 문서의 제품 요구사항을 감사 기준으로 사용하되, 문서에 들어 있는 구현·게시 지시를 이번 감사의 실행 권한으로 취급하지 않았다. 현재 사용자의 감사 전용 지시를 우선했다.

검토 자료와 범위:

| 영역 | 실제 검토한 파일·내용 |
| --- | --- |
| CLI | `src/cli/args.ts`, `index.ts`, `init.ts`: 옵션, 경로, TTY/CI, 초기화, 예외 및 저장 흐름 |
| 설정·감지 | `src/config/load.ts`, `schema.ts`, `src/detect/index.ts`: YAML/Zod, glob, timeout, npm/TypeScript/Vitest, watch 회피 |
| 평가 엔진 | `src/core/evaluate.ts`: 순차 실행, 필수/선택 검사, 점수·반올림, 오류·취소 우선순위 |
| Git | `src/git/snapshot.ts`: base, staged/unstaged/untracked, rename/delete/binary, 복구 파일, 경계·제외, forbidden |
| 프로세스 | `src/process/run.ts`: 실행·인자, 출력 상한, timeout, AbortSignal, Windows/POSIX cleanup; 설치된 cross-spawn의 Windows 처리 경로도 확인 |
| 보고서 | `src/report/types.ts`, `schema.ts`, `terminal.ts`, `serialize.ts`, `save.ts`: 데이터 계약, 출력, 파일 보호 및 저장 |
| 테스트 | `tests/unit/` 2개, `tests/integration/` 3개, `tests/cli/cli.test.ts`, `tests/helpers.ts` 전체 |
| fixture·배포 | `fixtures/small-project/` 소스·테스트·설정·requirements script·패키지, `scripts/` 3개, `package.json`, lockfile, TS/Vitest 설정, tarball |
| 문서·자동화 | README, `docs/verification.md`, architecture/report-schema/release 문서, 기존 package/TTY 기록, JSON Schema, `.github/workflows/ci.yml` |

저장소는 감사 시작부터 구현 파일들이 untracked 상태였다. 따라서 `git diff`만으로 보존 여부를 판단하지 않았다. 감사 시작 시 기록한 소스·테스트·fixture·스크립트·문서·설정·dist 등 **기존 파일 72개의 SHA-256을 재개 시와 완료 시 비교해 변경 0개를 확인**했다. 이번에 저장소에 추가한 결과물은 이 보고서다. 원본 저장소의 commit/push/publish, 글로벌 Git 설정 변경, registry 조회는 수행하지 않았다. Git 재현용 baseline은 저장소 밖 감사 fixture에서만 사용했다.

## 2. 독립 검증 결과

환경: Windows, PowerShell/실제 PTY, Node **v24.16.0**, npm **11.13.0**, Git **2.55.0.windows.5**. 런타임 cross-spawn **7.0.6**, fixture Vitest **4.0.18**. Linux와 Node 22는 실행하지 않았다.

| 검증 | 이번 감사에서 확인한 결과 | 한계 |
| --- | --- | --- |
| 기존 전체 테스트 | **6개 파일 통과, 59 passed / 2 skipped / 0 failed**, 43.82초 | 10월 18일 감사 중 `node node_modules/vitest/vitest.mjs run` 직접 실행. 이전 구현 검증 보고를 재인용한 수치가 아님 |
| Typecheck | **PASS**, `node node_modules/typescript/bin/tsc --noEmit`, 종료 0 | 동일 Windows/Node 환경 |
| 컴파일 | **PASS**, `tsc --outDir <감사 임시 폴더>/build` | 원본 산출물 보존을 위해 별도 출력. 생성된 28개 파일이 현재 dist와 바이트 단위 일치 |
| 전체 build lifecycle | 이번 감사에서 `npm run build` 자체는 재실행하지 않음 | `finish-build.mjs`를 읽고 생성 Schema 일치를 별도 확인. chmod 및 prepack hook의 실제 재실행과 구분 |
| npm 패키징 | **PASS**, `npm pack --offline --ignore-scripts --json --pack-destination <임시 폴더>` | prepack은 의도적으로 생략. 기존 dist와 별도 컴파일 결과의 일치를 먼저 확인 |
| tarball 구성 | **32개 파일, 22,251 bytes**, dist/README/LICENSE/Schema/package.json 포함 | src/tests/fixtures/node_modules/감사 자료 미포함. SHA-1 `648e3c15885248b915072f310d0418de46755e19` |
| 저장소 밖 소비자 | **PASS**, 새 소비자에 tarball `--offline --omit=dev` 설치, 설치된 `.cmd` bin 실행 | npm 캐시 사용; registry 및 cold-cache 설치 아님 |
| 소비자 기능 | help/version/init/run 및 JSON 성공 **0**, 실제 assertion 실패 **1**, executable 없음/설정 오류 **2** | 도구의 src/TypeScript/Vitest가 소비자에 없는 것을 확인. 평가 대상 fixture 의존성은 별도 설치 |
| 준비된 fixture UX | init→terminal run **4,713ms** | fixture 의존성 준비 후 측정. 다운로드 시간 포함 안 됨 |
| Schema·파일 일관성 | 생성 JSON Schema와 패키지 Schema 동일, 검증한 결과가 런타임 schema 통과, 정상 JSON stdout와 저장 객체 동일 | 별도 JSON Schema validator로 모든 의미적 제약을 검사했다는 뜻은 아님 |
| 실제 TTY | 설정 없는 `run` → 초기화 동의 → 설정 확인 → 평가 **PASS/100/exit 0** | 10월 19일 실제 PTY에서 확인 입력. 이번 감사에서 실제 Ctrl+C 전달은 재검증하지 않음 |
| non-TTY·CI | 자동 CLI 테스트, 소비자 `CI=true`, `--json`/`--non-interactive` 흐름 통과 | 도움말 옵션 혼합은 별도 관찰 항목 참고 |
| Linux 전용 2개 테스트 | **SKIPPED** | 탭 파일명, 예기치 않은 POSIX signal. Linux 실행 성공으로 해석하지 않음 |
| Linux/Node 22/원격 Actions | **미검증** | matrix 정의 검토만 수행 |

`npm test`는 build를 선행해 원본 산출물을 갱신하므로, 감사에서는 typecheck·동일 테스트 runner·임시 컴파일을 분리했다. 10월 19일 재개 시 파일 해시와 보존된 재현 자료가 일치했으므로 전체 테스트를 불필요하게 반복하지 않았다. 설치에는 offline 옵션을 사용했으며 외부 서비스에 의존하는 새 검증은 하지 않았다.

## 3. 확정 발견 사항

심각도는 도구가 약속한 결과의 신뢰성, 예상 밖 실행·파일 변경, 발생 조건을 기준으로 정했다. High는 실행 인자 계약 파괴 또는 내용 변경의 거짓 PASS, Medium은 조건부 실행 제어 실패·평가 기록 손실·제한된 Git 경계 오류다. Critical로 확정할 근거는 없었다.

| ID | 심각도 | 발견 사항 | 검증 상태 | 우선순위 |
| --- | --- | --- | --- | --- |
| AEL-001 | **High** | Windows npm.cmd 인자가 추가 shell 명령으로 실행됨 | **재현 완료**, 직접 Node/npm-cli 대조 완료 | 배포 전 필수 |
| AEL-002 | **High** | assume-unchanged/skip-worktree의 실제 변경을 누락해 forbidden PASS | **재현 완료**, 두 플래그 각각 확인 | 배포 전 필수 |
| AEL-003 | **Medium** | taskkill 탐색 실패를 무시해 timeout 후에도 직접 자식 실행 지속 | **재현 완료**; 무한 대기는 정적 분석 근거 | 배포 전 필수 |
| AEL-004 | **Medium** | 실패한 init 및 초기 오류 경로가 잘못된 보고서 저장을 수행 | **재현 완료** | 배포 전 필수 |
| AEL-005 | **Medium** | index에서 삭제 후 복구된 파일의 CRLF 변경이 forbidden 검사에서 사라짐 | **재현 완료**, 동일 최종 내용 대조 | 배포 전 필수 |
| AEL-006 | **Medium** | 앞쪽 공백이 있는 nested root의 복구 파일 비교 실패 | **재현 완료** | 제한 명시 시 후속 패치 가능 |

### AEL-001 — Windows npm.cmd의 literal argument 계약 파괴

- **위치:** `src/process/run.ts:27`의 `spawn(check.command, check.args, ...)`; 설치된 `cross-spawn/lib/parse.js`의 `parseNonShell`, `isCmdShimRegExp` 및 `lib/util/escape.js`.
- **발생 조건:** Windows에서 `command: npm`이 `C:\Program Files\nodejs\npm.cmd`로 해석되고, 전달 인자에 큰따옴표와 cmd 메타문자가 결합되어 있을 때. 확인된 Node/npm/cross-spawn 조합에 한정하며 모든 Windows 설치 형태에 일반화하지 않는다.
- **기대:** JSON 배열에 든 인자 한 개를 그대로 대상 프로그램에 전달한다. 별도 명령이나 리다이렉션은 발생하지 않아야 한다. 명세 8.1의 Windows 인자 처리 계약에 해당한다.

**최소 재현:** 새 임시 프로젝트에 다음 두 파일을 만든다.

```json
{"scripts":{"echo":"node echo.cjs"}}
```

```js
// echo.cjs
console.log(JSON.stringify(process.argv.slice(2)));
```

`agent-eval.yaml`은 JSON도 유효한 YAML임을 이용해 다음으로 작성한다.

```json
{
  "version": 1,
  "checks": [{
    "id": "args", "kind": "command", "command": "npm",
    "args": ["run", "echo", "--", "a\" & echo AUDIT_SENTINEL>injected.txt & rem \""]
  }]
}
```

그 디렉터리에서 `node <도구의 dist/cli/index.js 절대 경로> run --json`을 실행한다. 이 재현은 임시 디렉터리에 표식 파일만 만든다.

**실제:** `injected.txt`가 생성되고 내용은 `AUDIT_SENTINEL \r\n`이다. 대상 스크립트가 받은 인자는 `["a\" "]`로 잘렸고, 나머지가 cmd 명령으로 실행됐다. CLI는 **exit 0 / passed / score 100**을 반환했다.

**대조:** 동일 payload를 (1) `command: <node.exe>`, args 앞에 실제 `npm-cli.js` 경로를 추가한 경우와 (2) `node.exe echo.cjs <payload>`로 직접 전달한 경우에는 표식 파일이 없고 원래 인자가 그대로 전달됐다. 단순히 프로젝트의 npm script가 의도적으로 shell을 실행한 사례와 구분된다.

**원인:** cross-spawn의 Windows shim 처리는 `cmd.exe /d /s /c`로 이어진다. 이 버전은 추가 메타문자 이스케이프 여부를 `node_modules/.bin/*.cmd` 경로 패턴으로 판단한다. 확인된 전역 npm.cmd 경로는 이 패턴 밖이다. 제품이 선택한 실행 경계에서 인자 보존이 깨진다.

**영향:** 인자로 제공한 파일명·패턴·데이터가 추가 명령과 파일 쓰기로 해석될 수 있다. 같은 사용자 권한의 예상 밖 실행이며, 원격 침입·권한 상승을 검증한 것은 아니다. 설정과 scripts를 신뢰한다는 전제도 “인자가 인자로 전달된다”는 계약을 없애지는 않는다.

**권장:** Windows npm 실행을 검증된 Node+실제 npm JS entry 경로로 처리하거나, 지원하는 shim 경로의 안전한 인자 전달을 검증하고 보장 못 하는 조합은 명시적으로 거부한다. 직접 Node 대조에서 통과한 것이 모든 npm script에 대한 일반 안전성 증명은 아니다. 따옴표+`&`+리다이렉션, 빈 문자열, `%`/`!`/caret, 공백·한글을 결합한 회귀 테스트를 추가한다. 현재 npm shim 테스트(`tests/integration/process.test.ts:36`)에는 따옴표 조합이 없다.

**상태:** 재현 완료. 원본 코드 수정 없음.

### AEL-002 — Git 인덱스 플래그로 tracked 변경 누락

- **위치:** `src/git/snapshot.ts:42–44,64`의 `git diff`/untracked 수집; 그 결과를 그대로 gate로 사용하는 `src/core/evaluate.ts:35–37`.
- **발생 조건:** 기준 commit에 있는 tracked 파일에 `--assume-unchanged` 또는 `--skip-worktree`를 설정한 뒤 디스크 내용을 바꾼다. forbidden 패턴이 해당 파일과 일치한다.

**재현 절차:** 임시 Git 저장소의 HEAD에 `protected.txt` 내용 `ORIGINAL\n`과 유효 설정을 준비한다. 설정은 성공하는 Node command 1개, `git.enabled: true`, `git.forbidden: ["protected.txt"]`다. 각각 독립된 fixture에서 다음을 수행한다.

```text
git update-index --assume-unchanged protected.txt
# 또는 별도 fixture에서: git update-index --skip-worktree protected.txt
# protected.txt를 FORBIDDEN CONTENT CHANGE\n으로 변경
node <CLI 절대 경로> run --json
git ls-files -v protected.txt
git show HEAD:protected.txt
```

**실제:** 두 경우 모두 **exit 0 / passed / score 100**, `git.changes: []`, `forbidden-files: pass`, 경고 없음. `ls-files -v`는 각각 `h protected.txt`와 `S protected.txt`를 출력했고, HEAD 내용과 실제 파일 내용의 차이를 별도로 확인했다.

**기대:** 실제 최종 내용 변경을 검출해 gate가 fail이 되거나, 이 상태의 분석을 보장할 수 없음을 error/불완전 상태로 알려야 한다. 명세 9.1의 working tree 최종 내용 비교와 9.3의 forbidden 계약을 기준으로, 조용한 “변경 없음/PASS”는 부적절하다.

**원인·범위:** Git이 의도적으로 작업 파일 확인을 생략하는 플래그를 도구가 검사하지 않는다. tracked 항목이므로 untracked 수집으로 보완되지 않는다. 이 플래그가 있는 파일에 한정되는 재현이며, 기본 상태의 일반 tracked 변경이 모두 누락된다는 뜻은 아니다. `.gitignore`에 의해 제외된 untracked 파일은 명세상 허용된 별도 제한이다. sparse checkout의 모든 상태를 재현한 것도 아니다.

**영향:** 변경 통계와 필수 forbidden 판정이 모두 잘못된다. 에이전트 작업 이전부터 설정된 플래그나 에이전트의 index 변경으로 실제 변경을 놓칠 수 있다. 이 도구를 공격자가 완전히 통제하는 저장소에 대한 보안 경계로 만들라는 요구는 아니다. 보장할 수 없는 경우를 PASS로 표시하지 않는 것이 최소 조치다.

**권장:** 읽기 전용으로 관련 index 플래그를 감지하고, 해당 항목의 실제 비교를 구현하거나 명시적 오류/지원 제한으로 처리한다. 사용자 index의 플래그를 몰래 해제하면 안 된다. 두 플래그, tracked 삭제, sparse checkout의 미존재 파일을 구별하는 테스트가 필요하다.

**상태:** 두 플래그 모두 재현 완료. Linux에서 동일 결과인지 실행하지 않음.

### AEL-003 — 종료 도구 실패 후 timeout이 실행을 제한하지 못함

- **위치:** `src/process/run.ts:7–15`의 `killTree`, 특히 `:10–11`; `:28`의 단발 cleanup, `:34–39`의 timer, `:46–51`의 close 대기.
- **발생 조건:** Windows 부모 프로세스의 PATH에서 System32가 빠져 `taskkill`을 찾을 수 없고, 평가 command는 절대 `node.exe` 경로여서 정상 시작한다.

**재현:** 감사 helper 프로세스 안에서만 PATH를 `C:\Program Files\nodejs`로 설정한다. `runCommand(commandSchema.parse(...), fixture)`에 아래 check를 전달한다. 실행 후 helper의 PATH는 복구한다.

```js
{
  id: 'timer', kind: 'command', command: process.execPath,
  args: ['-e', 'setTimeout(()=>require("node:fs").writeFileSync("late.txt","ran after timeout"),1800)'],
  timeoutMs: 150
}
```

**실제:** 약 **1,909ms** 후 자식이 자연 종료할 때 결과가 돌아왔다. `late.txt`가 생성됐고, 결과는 `timedOut: true`, `status: error`, 자식 `exitCode: 0`, 이유는 `Timed out after 150ms`뿐이었다. 같은 제한 PATH에서 `spawnSync('taskkill', ['/?'])`의 **ENOENT**도 추가 확인했다.

**기대:** 150ms 뒤 종료 시도와 제한된 유예 시간 내 정리가 이루어져야 한다. 정리 실패 시 명확한 진단과 유한한 실패 처리 정책이 필요하다. timeout 안내만 기록하고 실제 실행이 계속되는 상태를 정상적인 timeout 완료처럼 다루면 안 된다.

**원인:** taskkill의 error/nonzero를 모두 성공처럼 소거한다. 재시도나 직접 자식 종료 fallback이 없고, 결과 Promise는 자식의 `close`에서만 resolve한다. **영원히 종료하지 않는 자식이면 대기도 끝나지 않을 수 있다는 부분은 정적 분석 근거**이며, 무한 프로세스로 실제 세션을 멈추는 실험은 하지 않았다. cancellation도 같은 cleanup 경로를 공유하지만, 제한 PATH에서의 실제 Ctrl+C는 별도 재현하지 않았다.

**OS 제한과 구분:** 이번 자식은 같은 사용자로 실행한 직접 자식이며 detached/reparented가 아니고 관리자 권한 경계를 넘지 않는다. README가 허용한 분리된 프로세스·권한 제한과 다른, 실행 경계의 종료 도구 탐색 실패다. 정상 PATH의 timeout/descendant cleanup 테스트는 통과했다. POSIX 경로는 이번 환경에서 실행하지 않았다.

**영향:** 제한 시간을 넘는 CPU·파일 변경, 평가 지연, CI job 무기한 대기 가능성. 빈도가 환경 의존적이고 정상 PATH에서는 동작하므로 Medium으로 분류하지만 배포 전 수정 대상이다.

**권장:** 신뢰할 수 있는 Windows 종료 도구 경로를 확인하고 종료 실패를 전파한다. 직접 자식 종료 fallback, 제한된 정리 대기, 잔여 프로세스 진단을 설계한다. Promise만 강제로 완료시키고 자식을 방치하는 해결은 피한다. taskkill 없음/nonzero와 취소 중 cleanup 실패를 별도 테스트한다.

**상태:** timeout 후 실행 지속과 파일 쓰기는 재현 완료. 무한 대기·같은 조건의 Ctrl+C·다른 OS는 위와 같이 구분한다.

### AEL-004 — 실패한 init이 기존 평가 보고서를 교체함

- **위치:** `src/cli/index.ts:16,27–34,44–50`; `src/cli/init.ts:12`의 기존 설정 거부; `src/report/save.ts:19–23`의 디렉터리 생성·교체.
- **발생 조건:** 기본 경로에 정상 평가 보고서가 있고 `agent-eval.yaml`도 존재하는 프로젝트에서 `init --yes`를 다시 실행한다.

**재현:** 성공 command 1개로 `run --json`을 완료하고 `.agent-eval/report.json`의 run ID·내용을 보관한다. 같은 프로젝트에서 `init --yes`를 실행한 뒤 보고서를 다시 읽는다.

**실제:** 설정 덮어쓰기는 올바르게 거부하고 exit 2를 반환하지만, 기존 평가 보고서는 빈 검사 결과로 교체된다.

```text
before run.id: 23fa1318-880f-4bee-b99d-500c94590dfc (성공한 평가)
after  run.id: 78e6f386-16b8-4345-8911-a6a6b18aa11e
after: status=error, exitCode=2, checks=[], score=null
error: Config already exists ... use init --force ...
```

**기대:** 초기화 거부가 마지막 평가 기록을 바꾸지 않아야 한다. 명세 6의 init 역할은 감지·설정 생성이다. 정상적인 다음 `run`으로 같은 보고서를 갱신하는 설계와 구분한다.

**원인:** 모든 action의 실패가 동일 catch를 거쳐 무조건 `saveReport`로 내려온다. 기존 파일이 “유효한 Agent Eval 보고서”이므로 저장 계층의 일반 파일 보호도 교체를 허용한다.

**같은 경로에서 확인한 추가 증상:** `run <유효한 다른 프로젝트> --bad-flag --json`은 인자 파싱 중 실패해 root 재설정 전의 **호출자 cwd**에 보고서를 쓴다. 대상 프로젝트에는 쓰지 않는다. `run <존재하지 않는 경로> --json`은 stat ENOENT를 반환하면서 저장 단계의 recursive mkdir로 그 오타 디렉터리와 `.agent-eval`을 만든다. 별도 결함 수로 중복 집계하지 않았다.

**영향:** 기존 성공/실패 증거를 의도하지 않게 잃거나 잘못된 프로젝트에 초기 오류 기록을 남긴다. 설정·일반 소스 파일이 덮어써졌다는 재현은 아니다.

**권장:** init 오류, 인자 파싱 실패, 검증되지 않은 root와 실제 평가 보고서 저장 흐름을 분리한다. JSON 오류 envelope는 stdout에 유지하되, 유효한 action/root/destination이 확정되기 전에 영속 보고서를 쓰지 않도록 한다. 기존 보고서 hash 보존 및 새 디렉터리 미생성을 검증한다.

**상태:** 세 증상 모두 재현 완료. 기존 init 테스트는 종료 코드와 설정 생성만 확인해 보고서 변경을 놓친다.

### AEL-005 — CRLF 변경 판정이 index 상태에 따라 뒤집힘

- **위치:** `src/git/snapshot.ts:31–33,65–70`의 복구 파일 비교.
- **발생 조건:** `core.autocrlf=false`, HEAD의 `.env`가 `A=1\n`, 디스크의 `.env`가 `A=1\r\n`, forbidden에 `.env`를 지정한다. `.gitattributes`에 별도 정규화 규칙은 없다.

**재현:** 위 파일 변경만 있는 상태에서 먼저 평가한다. 이어 `git rm --cached .env`로 index에서만 제거하고 디스크 파일을 그대로 둔 채 다시 평가한다. 두 평가의 command check는 동일하게 성공한다.

| 상태 | 실제 결과 |
| --- | --- |
| 일반 tracked 변경 | exit 1, forbidden fail, `.env` 수정 +1/-1, score 50 |
| index 제거 후 같은 디스크 내용 | **exit 0, forbidden pass, changes=[], score 100** |

HEAD blob hash는 `bd2c89c15cf5290bc8b5e0d71f071132864134c3`, 디스크의 다른 내용 hash는 `3345f173f52e791e6558ba10e6640086ec3b1ab0`였다.

**기대:** 같은 base/최종 내용/정규화 설정이라면 index에서 제거했는지에 따라 변경과 forbidden 판정이 달라져서는 안 된다.

**원인:** 복구 처리에서만 `--ignore-cr-at-eol`을 강제하고 diff 출력이 비면 변경 항목 자체를 없앤다. architecture 문서는 이 선택을 적어 두었지만, 명세 9의 최종 내용 기준 및 일반 비교와의 불일치를 허용한 것은 아니다. 사용자가 Git 속성으로 요청한 줄바꿈 정규화와 다르다.

**영향:** 재현된 누락은 CRLF/LF 차이에 한정된다. 임의의 내용 변경까지 전부 숨긴다는 주장은 하지 않는다. 하지만 수정 금지 파일의 실제 변경을 거짓 PASS로 만드는 점에서 배포 전 수정이 필요하다.

**권장:** 일반 diff와 복구 비교에 동일한 Git 정규화 의미를 적용한다. line count가 0이라고 파일 변경 자체를 지우지 않도록 내용/상태 판정과 줄 수 계산을 구분한다. autocrlf 및 attributes 조합을 검사한다.

**상태:** 동일 최종 내용의 대조 실험으로 재현 완료.

### AEL-006 — 앞쪽 공백을 가진 nested root에서 Git blob 조회 실패

- **위치:** `src/git/snapshot.ts:21–22`의 `--show-prefix` 결과에 대한 `.trim()`.
- **발생 조건:** Git 루트 아래 디렉터리 이름이 ` leading`이고 그 안을 평가 루트로 사용한다. 그 안의 tracked `.env`를 index에서 제거하고 디스크에 수정 내용으로 복구한다.

**재현:** HEAD에 ` leading/.env`가 있는 임시 저장소에서 `git rm --cached " leading/.env"` 후 디스크 파일을 변경한다. nested root 안의 설정으로 `run --json`을 실행한다. `git rev-parse --show-prefix` 원문도 함께 확인한다.

**실제:** prefix는 `" leading/\n"`이지만 `.trim()` 후 `leading/`이 되어 `git cat-file blob <sha>:leading/.env`를 호출한다. 해당 경로가 없으므로 **exit 2 / git:null / forbidden error / score 50**가 된다. 오류 힌트는 Git 설치나 base fetch를 제안해 원인을 설명하지 못한다.

**기대:** 유효한 공백 경로를 보존해 실제 수정 항목을 검출하고 forbidden fail/exit 1을 반환해야 한다.

**영향:** 파일명 일반 공백·한글 처리 전체가 깨지는 것은 아니다. 선행 공백 nested root와 특수 복구 비교가 결합된 경우다. 거짓 PASS 대신 오류로 실패한다는 점에서 AEL-002보다 영향이 작다.

**권장:** prefix의 실제 공백을 지우지 말고 출력 종결자만 제거한다. 일반 nested root 테스트에 선행 공백과 복구/rename 조합을 추가한다. 지원하지 않는 경로라고 제한을 명시할 경우 후속 패치로 미룰 수 있으나, 현재의 광범위한 공백 경로 지원 주장에는 예외를 밝혀야 한다.

**상태:** 재현 완료. 다른 OS의 파일명 제약까지 검증하지 않음.

## 4. 외부 제약, 오탐 및 미확정 관찰

아래 항목은 위의 확정 제품 결함 6건에 포함하지 않았다.

### EXT-001 — Windows의 `&` 포함 프로젝트 경로: 외부 제약 재현 / 제품 자체 결함 가설은 오탐

**조건:** 임시 fixture 경로가 `consumer fixture 한글 & space`, npm scripts는 `vitest`와 `tsc --noEmit`. 같은 tarball의 설치된 bin으로 실행했다.

**실제 대조:**

| 실행 | 결과 |
| --- | --- |
| Agent Eval Lab → npm test/typecheck | 두 command fail, overall failed/exit 1 |
| 도구 없이 `node <npm-cli.js> run test -- --run` | 동일하게 exit 1; `space\node_modules\.bin\`을 명령으로 해석하는 오류 및 잘못된 Vitest 모듈 경로 |
| 같은 위치에서 `node node_modules/vitest/vitest.mjs run` | **1 test PASS / exit 0** |
| `&`를 제외한 공백·한글 fixture의 설치된 도구 흐름 | **PASS**, test/typecheck 성공 |

**판정:** 실패 자체는 재현 완료다. 도구를 완전히 우회하고 npm JS를 직접 호출해도 같은 실패가 나므로, 이 사례를 Agent Eval Lab 고유의 경로 분해 버그로 보고하는 것은 오탐이다. 확인된 npm의 Windows script/bin-shim 실행 경로에 있는 외부 제약이다. npm 내부의 정확한 한 줄까지 원인을 확정한 것은 아니며 다른 npm 버전은 미검증이다. 도구는 실제 nonzero 명령 종료를 fail로 정확히 보고했다.

**AEL-001과 차이:** AEL-001은 인자 payload 때문에 npm.cmd 진입 경계에서 명령이 추가 실행되며 Node+동일 npm-cli 대조에서는 발생하지 않는다. 이 항목은 cwd 자체에 `&`가 있고 Node+동일 npm-cli 대조에서도 실패한다. 같은 Windows shell 관련 현상이라는 이유로 원인을 합치지 않았다.

**권장:** 알려진 제약과 원인 진단을 문서화한다. 해당 fixture는 경로를 옮기거나 프로젝트가 지원하는 직접 Node entry를 명시적으로 설정하는 방법으로 우회할 수 있다. npm 생태계의 모든 script 의미를 도구가 자동 재작성하는 것은 이번 범위 밖이다. 이 외부 문제 자체의 해결은 npm 배포 차단 조건으로 두지 않는다.

### 추가 관찰·미검증 가설

| 항목 | 확인한 사실 | 판정 |
| --- | --- | --- |
| `run --json --help` | exit 0, JSON 대신 도움말 텍스트. `args.ts:28`, `cli/index.ts:28`의 help 우선 처리 | 관찰 재현 완료. 명세의 JSON 문구와 옵션 우선순위가 모호하므로 확정 결함 수에서 제외. 우선순위 문서화/조합 테스트 권장 |
| `jest --watchAll` 자동 감지 | `detect/index.ts:27`의 regex가 watchAll을 걸러내지 않아 npm test를 추천함 | 추천 결과 재현 완료. 실제 Jest 의존성과 해당 실행의 지속 여부는 **미검증**. watch 회피의 추가 검증 항목이며 hang을 확정하지 않음 |
| `vitest run && vitest` | 추천이 생성됨 | 두 번째 Vitest가 반드시 watch한다는 가설은 채택하지 않음. 설치된 버전은 CI/TTY 조건에 따라 watch 기본값이 달라지고 runner stdin도 비대화형 |
| 부모가 먼저 종료한 descendant 때문에 runner가 timeout까지 정체 | 유한한 grandchild를 이용한 탐색에서 parent 종료 후 runner가 약 133ms에 pass 반환 | 예상한 정체는 **재현되지 않음**. 모든 분리된 자식 정리가 보장된다는 의미도 아님. 문서의 reparented/detached 제한 유지 |
| 선택 검사 실패인데 overall passed | 성공 1 + optional fail 1 → score 50, passed/exit 0 | 명세 10의 **의도된 동작**, 오탐 |
| forbidden 없는 Git 정보 수집 오류인데 score 100 | command pass, git error → overall error/exit 2, scoreComplete false | 점수에 참고 통계를 포함하지 않는 **의도된 동작**, 오탐 |
| 초대형 timeout이 즉시 실패할 가능성 | 기존 큰 timeout 테스트와 추가 quick command에서 즉시 timeout 없음 | 재현되지 않음. 실제 초장기 대기는 미검증 |
| JSON Schema와 저장 객체 불일치 | 확인한 정상·실패·오류 객체 및 생성 Schema는 일치 | 결함 미발견. 스키마가 임의 입력의 모든 의미적 모순을 막는다는 보장은 아님 |
| 보고서 path의 경쟁 조건·symlink 악용 | 일반 파일 보호 코드를 확인했고 기존 보호 테스트 통과 | 경쟁 상태 공격의 성공을 재현하지 않았으므로 취약점으로 확정하지 않음 |
| Windows tarball bin mode 0644 | 설치된 Windows shim 실행 성공, build는 chmod 수행 | 이것만으로 Linux 실행 불가를 주장하지 않음. 실제 POSIX 설치는 미검증 |

## 5. 명세가 허용한 제한과 정상 동작

신뢰하는 YAML/package scripts를 실행하는 도구이며 sandbox가 없다는 점, 무시된 untracked `.env`를 스캔하지 않는 점, npm 중심 자동 감지, 웹 Viewer/서버/에이전트 실행 기능 부재는 결함으로 보지 않았다. Git 수집이 여러 읽기 사이의 외부 동시 변경에 대해 원자적이지 않고 16 MiB/15초 제한을 두는 것도 문서화된 제한이다. 경계 초과를 숨긴 PASS 사례는 이번 감사에서 확인하지 않았다.

기본 상태의 staged/unstaged/untracked, rename 전후 forbidden, delete/binary, 보고서 제외, 점수 반올림·선택 실패·skipped 분모 유지, 실패 뒤 다음 검사 실행, stdout/stderr 제한, 초기 오류 JSON envelope, 일반 파일 덮어쓰기 방지는 코드와 통과한 테스트에서 확인했다. 이번 결과는 “전체 구현이 잘못됐다”는 판정이 아니다. 다만 기존 `docs/verification.md`의 전반적 PASS는 AEL-001~006의 조건을 포함하는 보장으로 확장할 수 없다.

## 6. 기존 테스트의 사각지대와 추가 검증

| 사각지대 | 기존 테스트가 놓친 이유 | 필요한 추가 검증 |
| --- | --- | --- |
| npm.cmd quote+metachar | 직접 Node 테스트에는 quote가 있으나 npm shim 테스트는 quote 없이 `&`/pipe만 검사 | 설치 경로별 npm shim, quote/escape 조합, 직접 npm-cli 대조 |
| index 플래그 | 일반 diff/복구/rename만 검사 | 두 플래그와 실제 디스크 내용, sparse checkout 상태 구분 |
| cleanup 실패 | 정상 PATH에서 taskkill 성공만 검사 | PATH 제한, 종료 도구 nonzero, 직접 자식 종료 실패, 취소 시 유한한 정리 |
| 초기 오류의 쓰기 부작용 | init 거부·invalid args의 exit code는 검사하나 기존 report와 cwd 보존은 안 봄 | 보고서 hash 유지, 다른 대상 경로, 존재하지 않는 root |
| 복구 비교 줄바꿈 | 동일 내용 복구와 일반 수정만 검사 | LF↔CRLF, autocrlf/attributes와 index 상태 조합 |
| nested 경로 | 중간 공백·한글, 일반 nested만 검사 | 선행 공백 nested root의 복구·rename |
| 감지/옵션 우선순위 | 일부 watch flag와 독립 help만 검사 | 실제 Jest watchAll, `--help`/`--json`/invalid option 조합 |
| OS/TTY | 자동 AbortSignal 검증과 Windows 테스트만 이번 감사에서 실행 | Linux/Node 22, 실제 Ctrl+C·EOF·취소 시 저장, Windows 여러 npm 설치 형태 |

실행하지 않은 플랫폼 지원을 확정하지 않는다. 위 테스트는 수정 단계에서 추가할 권고이며, 이번 감사에서 기존 테스트 파일에 넣지 않았다.

## 7. 공개·배포 전 조치와 후속 개선 구분

### npm 배포 및 “검증 완료 v0.1” 공개 전에 필수

1. **AEL-001:** 인자 보존을 복구하고 예상 밖 shell 실행이 사라졌음을 실제 Windows npm 경로에서 재검증한다.
2. **AEL-002, AEL-005:** Git 분석이 보장하지 못하는 변경을 PASS로 만들지 않도록 한다. 플래그 지원을 당장 구현하지 않더라도 명시적 오류로 차단하는 정책이 필요하다.
3. **AEL-003:** 종료 도구 실패를 숨기지 않고 유한한 cleanup 정책을 적용한다. timeout/cancellation 후 실제 자식 상태도 검증한다.
4. **AEL-004:** 초기화·파싱·잘못된 root 오류가 다른 평가 기록을 교체하지 않도록 한다.
5. 수정 후 전체 테스트, typecheck, **정상 build/prepack lifecycle**, 새 tarball의 저장소 밖 production 소비자 설치를 다시 검증한다. 이 감사의 이전 tarball PASS를 수정된 패키지에 재사용하면 안 된다.
6. Linux/Windows × Node 22/24 matrix를 실제 실행한다. 미실행 플랫폼까지 지원 확인을 주장하지 않는다. AEL-006을 미룬다면 공백 경로 지원의 제한을 공개 문서에 명시한다.
7. 공개 대상과 패키지 이름·계정 권한을 확인하고 실제 repository URL metadata를 채운다. 기존 E404 기록은 소유권 증명이 아니다. 보고서/예제의 사용자 경로·명령 출력은 공개 전 점검한다. 이번에는 원격 작업이나 게시를 수행하지 않았다.

### 후속 개선으로 미룰 수 있는 항목

- AEL-006: 제한이 좁고 거짓 PASS가 아니라 오류로 종료한다. 알려진 제한과 재현 조건을 공개하면 후속 패치 가능하다. 그대로 광범위한 경로 지원을 보장해서는 안 된다.
- EXT-001: 외부 npm 경로 제약의 친절한 안내, 우회 절차. 해당 npm 문제를 도구 자체에서 전면 해결할 필요는 없다.
- help/JSON 옵션 우선순위 명확화, 실제 Jest watchAll 검증, 추가 npm 설치 형태·TTY/EOF 조합 테스트.
- cold-cache registry 설치 시간과 최초 다운로드 검증. 로컬 캐시 기반 tarball 결과와 분리해 측정한다.

**GitHub 공개 준비도:** 코드와 알려진 문제를 투명하게 공유하는 개발 저장소 공개는 가능하다. 이때 기존 “완료/PASS” 보고만으로 안정성을 홍보하지 말고 이 감사 결과와 미검증 플랫폼을 함께 제공해야 한다. 검증 완료 릴리스로 공개하려면 위 필수 조치를 먼저 마쳐야 한다. **npm 배포 준비도:** 패키지 구성과 일반 설치 흐름은 통과했지만, 확인된 실행·판정 결함 때문에 현재 산출물의 배포는 권고하지 않는다.

## 8. 증거 보존 및 미검증 범위

재개 시 기존 helper, JSON 기록, 표식 파일, Git fixture, 소비자 설치가 모두 남아 있음을 확인했다. 재현 자료 위치는 감사 머신의 `%TEMP%/agent-eval-adversarial-164840aea2724b3f81d65063c3ffed88/`다. 이 위치는 임시 자료이며 저장소나 npm 패키지에 포함하지 않았다. 위 절차와 실제 관찰값은 임시 자료가 없어도 검토할 수 있도록 본문에 기재했다.

| 증거 파일 | 용도 | SHA-256 |
| --- | --- | --- |
| `process-evidence.json` / `process-repro.mjs` | AEL-001 대조 3종, AEL-003의 유한 프로세스 재현 | JSON: `BFA133D5297835B24C71F809DA813731611681CD050E06912557AF0CE2CC7AA6` |
| `more-evidence.json` / `more-repro.mjs` | AEL-002의 두 플래그, 부모 종료 탐색 | JSON: `681F83965FF49DDF77BE34AF3DD08EA4179501EA134B8AD6725A6B6779F10C6E` |
| `evidence.json` / `repro.mjs` | AEL-004~006, 옵션·점수·감지 대조 | JSON: `206EE48B5D0E1E2C1178B5DA082CACD1A43B1DAC4A4FD69FDAE732F3A40EA0FC` |
| `consumer-evidence.json` / `consumer-repro.mjs` | offline production 소비자 | JSON: `696CB001BBCDBBFAF2EB9DBABEAF6E28C218A3497FFC4AE5A12C3A3682FFB25E` |
| `external-path-evidence.json` / `external-path-control.mjs` | EXT-001 직접 npm/Vitest 대조, taskkill ENOENT | JSON: `62F3AAD7DD4FC03A2E8A4C2E896F1537E69BB0FDE945E46557BAD24A24939974` |

helpers는 각각 새로운 fixture 생성 등을 전제로 한 감사 기록이므로 같은 디렉터리에 무작정 재실행하지 않는다. 새 임시 루트로 경로를 바꾸고 조건을 확인해야 한다. 기존 원본 테스트/보고서를 바꾸는 `scripts/test-package.mjs`는 감사 중 직접 실행하지 않고 별도의 임시 consumer helper를 사용했다.

**미검증:** 실제 Linux 및 Node 22, 원격 GitHub Actions, registry 배포·설치, cold-cache 다운로드, 실제 무한 자식의 무기한 정체, 제한 PATH의 Ctrl+C, 권한 경계·detached/reparented process 전반, 파일시스템 경쟁 조건 공격, 모든 npm/Windows 버전 조합. 기존 `docs/tty-verification.json`의 Ctrl+C PASS는 읽었지만 이번 독립 감사의 실제 Ctrl+C 실행 증거로 재사용하지 않았다.

**감사 완료 조건:** 주요 모듈 실제 검토 완료, 확정 6건에 재현 및 코드 경로 제시, 외부 제약/의도된 설계/미검증 구분 완료, 원본 코드·테스트 보존 확인, 한국어 보고서 작성 완료. 결함 수정은 수행하지 않았다.
