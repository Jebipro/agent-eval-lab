# Agent Eval Lab v0.1 — Verified Defect Remediation

검증일: 2026-10-19 (Asia/Seoul). 대상: `docs/ADVERSARIAL_REVIEW.md`의 AEL-001~006.

**여섯 결함의 원래 재현 조건을 수정하고 회귀 테스트를 추가했다.** 검사 생략이나 거짓 PASS로 회피하지 않았다. Git index 플래그와 안전성을 확인할 수 없는 실행·정규화 조합은 명시적 error로 처리한다. 최종 전체 테스트는 **89 passed / 2 skipped / 0 failed, 총 91개, 8개 파일**이다.

원래 명세의 CLI·YAML 형식·JSON schemaVersion 1·점수·종료 코드 계약을 유지했다. 새 dependency나 제품 기능을 추가하지 않았다. EXT-001, sandbox, 웹 기능, 자동 감지 범위 확대는 작업 대상에서 제외했다. 원본 저장소의 commit/push/npm publish는 수행하지 않았다. Git baseline 및 index 조작은 회귀 테스트의 독립된 임시 fixture에서만 수행했다.

## 1. 결함별 수정 상태와 원래 사례의 전후 결과

| ID | 상태 | 수정 전 | 수정 후 실제 재현 결과 |
| --- | --- | --- | --- |
| AEL-001 High | **해결** | npm.cmd 인자의 따옴표/`&`/리다이렉션이 명령으로 해석되어 표식 파일 생성, PASS/100 | 표식 파일 없음. 원래 인자 한 개가 그대로 출력됨. 정상 literal 실행 PASS/100/exit 0. 안전한 실행 경로를 확인할 수 없는 shim은 error |
| AEL-002 High | **해결 — 명시적 안전 실패** | assume-unchanged / skip-worktree 각각 실제 금지 파일 변경 누락, PASS/100 | 두 경우 모두 `GIT_ERROR`, forbidden error, overall error/exit 2, score 50 및 incomplete. index와 플래그 보존 |
| AEL-003 Medium | **해결** | PATH에서 taskkill을 못 찾으면 timeout 150ms 이후에도 실행, 약 1,909ms 뒤 자연 종료, late.txt 생성 | 원래 PATH 제한 조건에서 약 **374ms** 내 반환, `timedOut: true`, error, late.txt 없음. 정상 PATH 및 제한 PATH의 실제 자식 종료·취소도 검증 |
| AEL-004 Medium | **해결** | 실패한 init이 이전 보고서를 교체; 잘못된 인자가 호출자 보고서 생성; 없는 프로젝트 경로 생성 | init은 exit 2지만 기존 성공 report의 run ID/내용 유지. invalid args는 caller/target report를 생성하지 않음. 없는 root도 생성하지 않음 |
| AEL-005 Medium | **해결** | autocrlf=false의 LF→CRLF 변경이 index 제거 후 사라져 PASS/100 | 일반 변경과 복구 변경 모두 `.env` 수정 1건, +1/-1, forbidden fail, score 50, exit 1 |
| AEL-006 Medium | **해결** | ` leading/` prefix가 `leading/`으로 손상되어 Git error/exit 2 | 원래 경로의 수정 내용 검출, forbidden fail/exit 1. 일반 공백·한글·선행 공백 조합 통과 |

감사 당시 helper 세 개를 **새로운 임시 루트**에 복사해 원래 재현 사례를 다시 실행했다. AEL-002에서 의도적으로 Git snapshot이 null이 되므로, 결과 수집 코드의 `git.changes` 접근만 optional 접근으로 바꿨다. 재현 조건·payload·원래 audit 자료는 바꾸지 않았다. 최종 회귀 suite에도 원래 조건을 포함했다.

AEL-004의 독립 재현에서는 run ID `850aaa9b-dbee-4302-994b-0aa158648b7d`가 실패한 init 전후 동일했고, 저장 파일은 `passed`, 검사 1개를 유지했다. AEL-002의 `ls-files -v` 결과도 각각 `h protected.txt`, `S protected.txt`로 유지됐다.

## 2. 구현 변경

### AEL-001: Windows 실행 인자 경계

- 수정: `src/process/run.ts`, 추가: `src/process/invocation.ts`.
- Windows에서 실제 npm.cmd 설치 경로와 인접한 npm package/`bin/npm-cli.js`를 확인한다. 확인된 entry는 현재 Node 실행 파일에 argv 배열로 전달해 batch shim을 우회한다.
- 보고서에는 사용자가 설정한 원래 command/args를 유지한다. stdout의 실제 전달 인자를 대조했다.
- 알 수 없는 npm shim은 실행 전에 error를 반환한다. 다른 Windows batch 파일에 quote/메타문자/줄바꿈을 전달하는 안전하지 않은 조합도 명시적으로 거부한다. 이 경우 사용자가 native executable 또는 JS entry를 명시하도록 안내한다.
- 기존의 단순 npm test/typecheck 및 공백·한글 인자 흐름을 보존했다. 모든 Windows npm 설치 관리자·임의 wrapper를 자동 지원한다고 주장하지 않는다.

### AEL-002: 숨겨진 index 항목

- 수정: `src/git/snapshot.ts`.
- 읽기 전용 `git ls-files -v -z`로 평가 범위의 assume-unchanged/skip-worktree를 검사한다. 발견 시 관련 경로와 이유를 포함한 Git 오류를 반환한다.
- index를 해제하거나 다시 쓰지 않는다. `.git/index` 바이트 보존을 회귀 테스트로 검증했다.
- 형제 패키지와 기존 제외 경로는 평가 범위에 끌어들이지 않는다. 활성 forbidden gate는 error가 되고, 독립 command check는 기존 명세대로 계속 실행한다.
- sparse checkout 등으로 skip-worktree가 설정된 평가 범위도 현재는 명시적 오류 대상이다. “변경 없음”으로 인증하지 않는다.

### AEL-003: timeout/cancellation 정리

- 수정: `src/process/run.ts`, 추가: `src/process/cleanup.ts`.
- Windows 종료 도구는 PATH가 아닌 절대 `SystemRoot/System32/taskkill.exe` 경로로 실행한다.
- taskkill error/nonzero/실행 지연을 확인한다. 종료 도구에는 2초 제한을 두며, 실패 시 직접 자식에 SIGKILL fallback을 요청하고 실제 exit 이벤트를 확인한다.
- exit 확인은 시도별 최대 1초, 남은 pipe 대기는 500ms로 제한한다. 종료 도구 자체의 kill 요청이 실패해도 예외로 중단하지 않고 불확실성을 진단한다.
- 직접 자식의 종료와 전체 트리 정리 확인을 구분한다. 정리 실패는 기존 check `reason`에 기록하고 해당 check를 error로 둔다. 직접 자식 종료를 확인하지 못한 경우 `termination NOT confirmed`와 PID를 남긴다. 권한 제한을 억지로 성공으로 바꾸지 않는다.
- 정상 취소는 skipped를 유지한다. 취소 중 cleanup 실패는 check error로 기록하되, 전체 취소 상태/exit 130 및 미완료 점수 계약은 유지한다. 새 JSON 필드는 없다.

### AEL-004: 초기 오류의 저장 금지

- 수정: `src/cli/index.ts`.
- 유효한 run root와 설정을 확인한 뒤에만 보고서 저장을 허용한다.
- init 실패, 옵션 파싱 실패, root 검증 실패, 설정 오류는 stdout 오류 envelope를 반환하며 기존 평가 report 및 디렉터리를 변경하지 않는다.
- 정상 평가의 report 저장, write failure/exit 2, 일반 소스 파일 보호는 기존 테스트로 재검증했다.
- README, architecture, report-schema 문서에 “초기 오류는 stdout에만 반환”하는 저장 정책을 반영했다. JSON 형식과 오류 종료 코드는 유지된다.

### AEL-005: Git 줄바꿈 정규화

- 수정: `src/git/snapshot.ts`.
- 복구 파일만 무조건 CR을 무시하던 비교를 제거했다.
- `git check-attr`와 **`-w` 없는** `git hash-object --path`로 실제 Git 정규화 결과를 확인한다. 바이트 보존 방식으로 CRLF 변환 후보를 만들고 Git blob hash와 일치하는지 검증한다. index/object를 쓰지 않는다.
- 자동 text 처리에서는 기존 CRLF base blob을 보존하는 Git 의미를 반영한다. 명시적 text/eol 속성은 해당 정규화 의미를 따른다.
- custom clean filter나 working-tree encoding이 복구 비교에 필요한 경우, 프로젝트 filter를 실행하거나 결과를 추측하지 않고 명시적 오류를 반환한다. 지원하지 않는 기타 변환도 오류로 처리한다.
- 기존 16 MiB/15초 제한, 변경 중복 제거, rename 복구 처리, unknown line count 계약을 유지한다.

### AEL-006: 경로 prefix 보존

- 수정: `src/git/snapshot.ts`.
- `--show-prefix`에 적용하던 `.trim()`을 제거하고 출력 종결자만 제거한다. 선행 공백 등 실제 경로 문자를 보존한다.
- 동일한 방식으로 normalization에 필요한 `--show-toplevel` 결과도 처리한다.

## 3. 추가·변경한 회귀 테스트

수정 전 먼저 `tests/integration/remediation.test.ts`의 초기 16개를 실행했다. **10 failed / 6 passed**였으며 여섯 결함 모두 실패 사례가 확인됐다. 이후 정상 동작 보존 및 종료 실패 경계 검증을 확장했다.

| 파일 | 개수 | 검증 내용 |
| --- | --- | --- |
| `tests/integration/remediation.test.ts` | **24개 신규** | 원래 npm injection, quote·`&`·pipe·percent·exclamation·caret·빈 문자열·한글, unknown shim 거부, 두 index 플래그 및 index 보존, 제한 PATH의 timeout/cancel 및 실제 PID 종료, 초기 오류 파일 보존, autocrlf false/true/input, text/eol/-text/text=auto, 기존 CRLF blob, clean filter 미실행, nested 경계·선행 공백·한글 |
| `tests/unit/cleanup.test.ts` | **6개 신규** | taskkill ENOENT/nonzero/hang/helper-kill 실패, 취소 중 cleanup 실패, 종료 불가능 상태의 정직한 진단과 유한한 반환 |
| `tests/integration/process.test.ts` | 기존 assertion 보존 | 실패 시 실제 result를 보여주는 assertion 메시지만 보강. 기존 기대값과 검사를 약화하지 않음 |

cleanup 테스트의 구분: 제한 PATH 사례와 정상 timeout/cancellation은 실제 Windows OS 경로에서 실행했다. 종료 도구의 ENOENT/nonzero/hang/helper-kill 실패는 taskkill 경계에 fault를 주입하고, **대상 Node 자식은 실제로 실행해 PID가 사라졌는지 확인**했다. 종료 불가능한 자식 사례는 제어된 테스트 double로 진단/유한 반환을 확인했다. 실제 관리자 권한 경계의 강제 종료 성공을 주장하지 않는다.

수정 중 발견·해결한 직접 관련 회귀는 다음과 같다.

- taskkill 성공과 늦게 도착하는 자식 exit 이벤트 사이의 경합으로 정상 취소가 error가 되는 경우를 수정했다. 성공한 종료 요청 뒤 exit 확인을 기다리고 fallback 결과와 tree 실패를 분리했다.
- 기존 CRLF blob과 자동/명시적 Git 속성의 차이를 추가 대조하여 복구 비교를 보완했다.
- 속성만 바뀐 fixture의 Git stat shortcut이 대조 결과에 섞이지 않도록, 테스트에서 서로 다른 유효 timestamp를 사용했다. 프로덕션 코드가 사용자 파일 timestamp/index를 변경하는 방식은 사용하지 않았다.
- cleanup helper 자체의 kill 요청 예외도 오류 진단과 직접 자식 fallback을 막지 않도록 처리했다.

이번 범위와 무관한 신규 기능이나 EXT-001 우회 기능은 추가하지 않았다.

## 4. 최종 검증

환경: Windows, Node **v24.16.0**, npm **11.13.0**, Git **2.55.0.windows.5**, PowerShell/실제 PTY. 지원 Node 범위·dependency 버전·lockfile 변경 없음.

| 절차 | 결과 |
| --- | --- |
| 원래 audit 재현 6건 | **PASS** — 위 전후 표 및 새 임시 helper 실행 결과 |
| 추가 회귀 | **30개 통과** — integration 24 + cleanup 6 |
| 기존 suite 포함 전체 | **8개 파일 PASS, 89 passed / 2 skipped / 0 failed (91개), 95.23초** |
| OS 조건 제외 | 기존 Windows 제외 2건: POSIX signal, 탭 파일명. 신규 테스트를 제외해 PASS를 만든 것이 아님 |
| strict typecheck | **PASS**, `npm run typecheck`, 종료 0 |
| 정상 build | **PASS**, `npm test`의 `npm run build`에서 tsc 및 finish-build 수행 |
| 정상 pack/prepack | **PASS**, `npm run test:package` 종료 0. 정상 `npm pack --json`의 prepack에서 build 수행, tarball 36개 파일 확인 |
| 저장소 밖 소비자 설치·CLI | **PASS**, 새 tarball을 새 외부 소비자에 `--omit=dev`로 설치. help/version, init/run, schema, 성공·실패·오류 종료 코드 및 JSON 일관성 확인. 소스·개발 runner 불필요 |
| JSON/terminal/exit | 성공 0, 실제 assertion fail 1, 실행/설정 오류 2, 실제 취소 130 확인. 저장 성공 시 JSON stdout와 파일 객체 동일 |
| 실제 Windows TTY | 설정 없는 run → 초기화 동의 → 설정 확인 → PASS/100/exit 0 |
| 실제 Windows Ctrl+C | **native CLI exit 130**, cancelled, skipped 2, scoreComplete false, 실행 중 자식 PID 소멸, 후속 파일 쓰기 미실행 |
| non-TTY/CI | 자동 CLI suite 및 소비자 CI=true, --json/--non-interactive 흐름 통과 |
| Linux / Node 22 / 원격 Actions | **미검증**. Windows 결과로 대체하지 않음 |

Ctrl+C는 PowerShell wrapper 자체도 반응해 tool session 종료 코드가 1일 수 있다. 이 값을 CLI 종료 코드로 사용하지 않았다. Node 부모가 native 자식의 종료를 별도로 기록한 값은 `{ "code": 130, "signal": null }`이며 저장된 보고서와 일치한다.

패키지 검증은 **2026-10-19 01:44:14 KST**에 완료됐다. `docs/package-verification.json`과 `package.log`의 결과가 일치한다. 소비자 설치 3,759ms, fixture dependency 설치 3,263ms, 준비된 fixture의 init/run/결과 읽기 3,673ms였다. npm offline cache를 사용했으므로 registry 최초 다운로드나 cold-cache 성능 검증은 아니다. tarball에는 dist, README, LICENSE, package.json, report schema가 포함되고 src/tests/fixtures 및 평가 보고서는 포함되지 않았다.

검증한 `agent-eval-lab-0.1.0.tgz`의 SHA-256은 `87C1101F64F3012DFD81561B130DD64A42000D772D32652C218BC3FCC43FC707`이다. 작업 재개 시 tarball의 **36개 파일 모두 현재 저장소의 대응 파일과 바이트 단위로 일치**함을 확인했다. 소스·테스트의 마지막 수정은 최종 전체 테스트 시작 전이며, 보존된 전체 테스트 로그·패키지 로그·TTY 보고서·native 종료 기록과 감사 보고서 해시를 재확인했다. 성공한 검증을 불필요하게 반복하지 않았고, 이번 재개 작업에서는 이 보고서의 미확정 패키징 결과만 확정하고 근거를 보완했다. 프로덕션 코드와 테스트는 추가 수정하지 않았다.

## 5. 변경 파일 및 보존 확인

- 프로덕션: `src/cli/index.ts`, `src/git/snapshot.ts`, `src/process/run.ts`, 신규 `src/process/invocation.ts`, `src/process/cleanup.ts`.
- 테스트: 신규 `tests/integration/remediation.test.ts`, `tests/unit/cleanup.test.ts`, 기존 process 테스트의 진단 메시지.
- 문서: README, `docs/architecture.md`, `docs/report-schema.md`, 이 보고서. 정상 패키지 검증이 `docs/package-verification.json`을 갱신했다.
- 빌드 산출물 및 로컬 tarball은 정상 lifecycle로 재생성했다. CLI 옵션, YAML schema, report schema 필드, 버전, dependencies는 유지했다.
- **`docs/ADVERSARIAL_REVIEW.md` 보존 SHA-256:** `5D860C29616E5DCD4D96177DAC45F69C97B62320AB3800D17E1C6CD63B25D03A`. 발견 사실·이전 결과를 삭제하거나 수정하지 않았다.

원래 audit helper 결과와 이번 결과는 서로 다른 임시 디렉터리에 보관했다. 이번 자료는 `%TEMP%/agent-eval-remediation-1792341432228/`의 `evidence.json`, `more-evidence.json`, `process-evidence.json`, `full-test.log`, `package.log`, TTY native 종료 기록이다. 임시 자료가 없어도 검토할 수 있도록 본문에 주요 전후 결과와 검증 조건을 기록했다.

## 6. 남은 제한과 공개·배포 준비도

**AEL-001~006 중 미완료 항목은 없다.** 단, AEL-002는 플래그를 지원해 전체 내용을 강제로 스캔하는 방식이 아니라, 허용된 선택지인 명시적 오류로 해결했다. 다음 제한은 유지한다.

1. Linux/Node 22 및 원격 Actions matrix는 실제 실행하지 않았다. 해당 플랫폼까지 검증 완료라고 주장할 수 없다.
2. 알 수 없는 Windows npm shim과 안전하지 않은 batch 인자 조합은 실행하지 않는다. 사용자는 실제 native executable/JS entry를 명시해야 한다.
3. in-scope assume-unchanged/skip-worktree, 복구 파일의 custom clean filter/working-tree encoding 등 보장할 수 없는 분석은 error다. 사용자 index를 자동 수정하지 않는다.
4. cleanup이 실패하면 직접 자식 종료 여부와 tree 불확실성을 알린다. 권한 경계·detached/reparented 프로세스에 대한 OS 한계는 남으며 수동 정리가 필요할 수 있다. 확인되지 않은 종료를 성공으로 보고하지 않는다.
5. EXT-001의 npm 자체 `&` 경로 제약은 범위 밖이며 그대로 남아 있다. sandbox 부재, npm 중심 감지, Git의 비원자적 snapshot/출력 한계도 유지한다.
6. registry 게시·설치, cold-cache 최초 다운로드, 패키지 이름 소유권은 검증하지 않았다.

**GitHub 공개:** 수정 코드와 검증 자료를 개발 저장소로 공개할 준비는 됐다. 실제 대상 URL/계정과 공개할 예제·보고서 내용을 확인하고, 미검증 플랫폼을 명시해야 한다. 이번 작업에서 공개 작업은 하지 않았다.

**npm 배포:** 확인된 여섯 결함에 따른 차단 사유는 해소했다. Windows 로컬 배포 산출물과 소비자 흐름의 검증 범위를 넘어서는 전체 지원 릴리스 전에는 Linux/Windows × Node 22/24 CI를 실제 통과시키고, 패키지 이름·계정 권한·repository metadata를 확인해야 한다. 로컬 tarball 성공을 registry 게시 성공으로 표현하지 않는다.
