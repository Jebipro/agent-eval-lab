# GitHub publication and CI verification

검증일: 2026-10-19 (Asia/Seoul). **GitHub Public 저장소 생성 및 main push 완료. 실제 CI에서 발견한 Windows 소비자 검증 스크립트 문제를 수정했고, 네 환경의 실제 CI가 모두 PASS했다.** npm publish, GitHub Release, Pages는 수행하지 않았다.

## 1. 공개 상태와 커밋

| 항목 | 실제 확인 결과 |
| --- | --- |
| 저장소 | https://github.com/Jebipro/agent-eval-lab |
| 공개 범위 / 기본 브랜치 | **Public / main**, GitHub API 확인 |
| 최초 커밋 | `6b208ec14386f805d52e4455fd0d23aaa0f50e37` — 승인된 65개 파일, parent 없는 root commit |
| CI 수정 커밋 | `13fc270a7bfa6067cd07ceea4a9454ab195dc1c3` — 소비자 검증 스크립트만 최소 수정 |
| 커밋 identity | Jebipro / `182050296+Jebipro@users.noreply.github.com` (author/committer 모두 확인) |
| 실제 전송 범위 | `refs/heads/main:refs/heads/main`만, force/follow-tags/mirror/all 미사용 |
| 원격 공개 확인 | README와 주요 디렉터리 확인, 최초 65개 파일의 경로와 Git blob hash가 로컬 승인 커밋과 모두 일치 |

사용자가 공개 전 결과를 확인하고 저장소 생성·최초 commit/push·CI 실패 최소 수정을 명시적으로 승인했다. 최초 commit 직전 staged 파일을 보고서의 65개 목록 및 실제 파일 바이트와 대조했고, 민감정보를 재검색했다. 이전 준비 결과와 실질적 차이는 없었다. 사용자 브랜치에 기존 commit은 없었으며 로컬 Codex snapshot tree refs는 보존하되 전송하지 않았다. 원격 refs 조회에서도 main과 HEAD만 확인했다. 전역/저장소 Git identity 설정은 변경하지 않고 각 commit 명령에서 noreply 이메일을 지정했다.

## 2. 보안·개인정보와 기존 기록 보존

- 공개 후보/staged 내용에서 token, private key, credential assignment, 개인 홈 절대 경로 등을 점검했다. 게시 대상에서 추가 비밀정보는 발견하지 않았다. 이는 패턴 검색과 파일 검토의 결과이며 모든 형태의 비밀정보 부재를 보증하는 것은 아니다.
- 공개 준비 중 예제 JSON 네 개의 개인 임시 경로만 `<project>`로 치환했다. 기존 시간/run ID/점수/검사 결과는 보존했다. 예제 생성 스크립트는 앞으로 native 및 slash 경로를 치환한다.
- node_modules, dist, tarball, coverage, .agent-eval, .ci-results, logs, 개인 .env/.npmrc 및 OS/cache 파일은 Git에서 제외했다. 공개할 파일 목록은 마지막 절의 65개로 유지했다. 외부 첨부 마스터 프롬프트는 업로드하지 않았다.
- 공개 전 익명화하지 않은 예제가 남아 있는 로컬 snapshot refs는 공개 이력에 연결하지 않았다. 최초 공개 commit의 parent 목록은 비어 있다.
- 프로덕션 `src/`, 기존 `tests/`, lockfile, 감사·수정 보고서 및 이전 검증 JSON은 이번 공개/CI 작업에서 변경하지 않았다. CI 수정은 기존 65개 중 `scripts/test-package.mjs` 안에만 적용했다. README/release/readiness 문서는 실제 공개 상태와 증거를 반영했다.
- 감사 원본 SHA-256: `5D860C29616E5DCD4D96177DAC45F69C97B62320AB3800D17E1C6CD63B25D03A`.

## 3. README·메타데이터·CI 설정

README는 목적/지원 범위/제외 기능, Node 22.12+, 현재 clone·tarball 사용법, **npm 게시 후에만 유효한 npx 예시**, CLI/종료 코드/JSON 예시, 제한·보안·라이선스·검증 링크를 구분한다. `repository`, `homepage`, `bugs`는 사용자가 지정한 공개 저장소를 가리킨다. MIT/bin/files allowlist/prepack build 및 dependency/version/CLI 계약은 유지했다. dist는 CI/prepack에서 생성한다.

기존 Windows/Ubuntu × Node 22/24 matrix와 `npm ci → typecheck → npm test → build → pack dry-run → test:package`를 유지했다. job timeout은 20분, 권한은 contents:read, checkout credential persistence는 false다. 공식 [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)를 확인된 전체 SHA로 고정했다. 별도 secrets는 사용하지 않는다.

명시적 bash pipefail로 실패를 유지하고 단계별 로그와 JUnit을 always artifact로 보존한다(14일). 과거 package record를 job 시작 시 제거하므로 패키지 검증이 실행되지 않았는데 이전 PASS가 artifact에 섞이지 않는다. 테스트 삭제/skip 확대/continue-on-error는 사용하지 않았다.

## 4. 실제 CI 결과 및 확인 범위

최초 실행: [39216049196](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216049196), SHA `6b208ec14386f805d52e4455fd0d23aaa0f50e37`. Ubuntu 22/24는 전체 단계 PASS. Windows 22/24는 전체 테스트 89 passed/2 skipped, typecheck/build/pack을 통과했지만 외부 소비자 경계 assertion에서 FAIL했다. 실패를 성공으로 덮어쓰거나 기록에서 제거하지 않는다.

수정 후 실행: [39216453610](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216453610), SHA `13fc270a7bfa6067cd07ceea4a9454ab195dc1c3`.

| OS | 실제 Node / npm | 수정 후 결과 | 전체 테스트 | typecheck/build/pack/외부 소비자 |
| --- | --- | --- | --- | --- |
| Windows | 22.23.3 / 10.9.9 | [PASS](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216453610/job/117941330158) | 89 passed / 2 skipped / 0 failed | 모두 PASS |
| Windows | 24.21.0 / 11.19.0 | [PASS](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216453610/job/117941329937) | 89 passed / 2 skipped / 0 failed | 모두 PASS |
| Ubuntu Linux | 22.23.3 / 10.9.9 | [PASS](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216453610/job/117941330794) | 81 passed / 10 skipped / 0 failed | 모두 PASS |
| Ubuntu Linux | 24.21.0 / 11.19.0 | [PASS](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216453610/job/117941330229) | 81 passed / 10 skipped / 0 failed | 모두 PASS |

실제 각 job의 status/conclusion/단계와 다운로드한 artifact의 JUnit·environment·package record를 대조했다. 네 환경 모두 91개 테스트 중 해당 OS 분기가 실행됐으며, 각각 36개 tarball 파일과 8개 소비자 검증 항목이 확인됐다. 준비된 fixture의 init/run/읽기는 Windows 22/24에서 2,880/2,057ms, Ubuntu 22/24에서 1,747/1,656ms였다. Windows의 2개 제외는 POSIX signal/탭 파일명이고, Linux의 10개 제외는 Windows batch/taskkill 전용 검사다. 원래 OS 조건을 유지했다. Node 22.12 최소 버전 자체나 모든 minor/OS 조합을 검증한 것은 아니다.

이 표는 명시한 SHA의 실제 실행 증거다. 결과 기록을 위한 후속 문서 commit에도 별도 matrix를 실행하며, 이전 SHA의 PASS를 최신 commit의 결과로 대신하지 않는다. 최신 branch 실행은 [main CI 목록](https://github.com/Jebipro/agent-eval-lab/actions/workflows/ci.yml?query=branch%3Amain)에서 해당 SHA와 대조할 수 있다.

## 5. 발견한 문제와 최소 수정

**CI-001: Windows 서로 다른 드라이브의 외부 소비자를 잘못 거부하는 검증 스크립트 결함.** 실제 hosted runner의 소스 checkout은 D:에, 임시 소비자는 C:에 생성된다. `path.win32.relative('D:/checkout/project', 'C:/temp/consumer')`는 C:의 절대 경로를 반환한다. 기존 `relative(...).startsWith('..')` 조건은 false여서 pack/install 전에 “Consumer must be outside source repository”로 종료됐다. 평가 엔진의 판정 오류가 아니라 개발용 패키지 검증 경로 처리 오류다.

`scripts/test-package.mjs`에서 서로 다른 드라이브의 절대 결과, 정확한 부모 경로 및 부모 separator prefix를 구분하도록 수정했다. 동일/하위 디렉터리는 계속 거부하며, `..consumer`처럼 점 두 개로 시작하는 내부 폴더도 거부한다. Windows/POSIX의 다른 드라이브·형제·부모·동일·하위 경로 **9개 회귀 assertion**을 실제 package 검증 시작 전에 매번 실행한다. Vitest 91개를 줄이거나 교체하지 않았으며 9개 assertion을 Vitest 통과 수에 합산하지 않는다.

로컬에서 수정된 정상 pack/prepack 및 저장소 밖 소비자 설치가 통과했다. 실제 Windows의 다른 드라이브 재현 조건에서도 위 새 원격 job 두 개가 모두 통과해 해결을 확인했다. 그 외 제품 결함/신규 기능 변경은 없다.

## 6. 패키징·과거 증거·남은 절차

- 기존 Windows 로컬 전체 89 passed/2 skipped, strict typecheck/build, 실제 TTY 및 Ctrl+C native 130 기록은 보존했다. 초기 verification과 remediation 결과는 당시 이력으로 읽어야 한다.
- 공개 준비 tarball의 별도 기록은 [publication-package-verification.json](publication-package-verification.json)에 보존했다. 당시 36개 파일, SHA-256 `9E3F308A7C8E6B0D1A66EBA604A2699FEC54DA2A23120C89528307D639869DF4`이며 이후 README 문구가 바뀐 산출물의 해시로 재사용하지 않는다.
- 원격 package 검증은 각 runner가 새로 pack한 정확한 tarball을 저장소 밖에 `--omit=dev`로 설치하고 installed bin help/version/init/run, 실제 실패 1/오류 2, schema와 JSON stdout/저장 파일 동등성을 검증한다. 결과와 설치 시간은 각 실행 artifact에 있다. repository 테스트 로그/패키지 기록을 로컬 머신의 과거 JSON으로 덮어쓰지 않는다.
- npm registry에 agent-eval-lab을 게시하거나 해당 공개 패키지를 내려받아 검증하지 않았다. cold-cache 최초 공개 다운로드, npm 이름 사용 권한/계정/게시 인증 및 실제 게시 승인은 별도로 필요하다. 2026-10-18 E404 조회는 이름 소유권을 보장하지 않는다.
- EXT-001의 npm 자체 & 경로 제약, sandbox 부재, detached/권한 경계 cleanup 한계, Git 비원자적 snapshot 및 미지원 index/filter 안전 오류 등 기존 제한은 유지한다.
- GitHub Release/Pages/npm publish는 요청 범위 밖이므로 수행하지 않는다. CI는 실제 기록한 버전의 hosted runner 결과이며 모든 배포 환경의 보증은 아니다.

## 7. 최초 업로드 파일

승인 후 최초 commit의 staged 및 원격 blob까지 대조한 **65개 파일**이다. 후속 수정도 이 목록 안의 파일만 사용했다. 빌드/임시 산출물 및 내부 Git refs는 제외한다.

```text
.github/workflows/ci.yml
.gitignore
LICENSE
README.md
docs/ADVERSARIAL_REVIEW.md
docs/GITHUB_RELEASE_READINESS.md
docs/REMEDIATION_REPORT.md
docs/architecture.md
docs/package-verification.json
docs/publication-package-verification.json
docs/release.md
docs/report-schema.md
docs/report.schema.json
docs/tty-verification.json
docs/verification.md
examples/README.md
examples/no-dependency-changes.yaml
examples/reports/execution-error.json
examples/reports/forbidden-file.json
examples/reports/requirements.json
examples/reports/success-no-git.json
examples/reports/test-failure.json
examples/reports/timeout.json
examples/reports/type-error.json
examples/requirements.yaml
examples/terminal.txt
fixtures/small-project/.gitignore
fixtures/small-project/package-lock.json
fixtures/small-project/package.json
fixtures/small-project/requirements.mjs
fixtures/small-project/src/add.test.ts
fixtures/small-project/src/add.ts
fixtures/small-project/tsconfig.json
package-lock.json
package.json
scripts/examples.mjs
scripts/finish-build.mjs
scripts/test-package.mjs
src/cli/args.ts
src/cli/index.ts
src/cli/init.ts
src/config/load.ts
src/config/schema.ts
src/core/evaluate.ts
src/detect/index.ts
src/git/snapshot.ts
src/process/cleanup.ts
src/process/invocation.ts
src/process/run.ts
src/report/save.ts
src/report/schema.ts
src/report/serialize.ts
src/report/terminal.ts
src/report/types.ts
tests/cli/cli.test.ts
tests/helpers.ts
tests/integration/detect.test.ts
tests/integration/git.test.ts
tests/integration/process.test.ts
tests/integration/remediation.test.ts
tests/unit/cleanup.test.ts
tests/unit/config.test.ts
tests/unit/score.test.ts
tsconfig.json
vitest.config.ts
```

