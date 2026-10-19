# GitHub publication and CI readiness

점검일: 2026-10-19 (Asia/Seoul). **공개 전 준비 완료, 저장소 생성·최초 push 승인 대기. 원격 CI는 아직 실행하지 않았다.** npm publish, GitHub Release, Pages 작업은 수행하지 않았다.

## 1. 대상과 현재 Git 상태

| 항목 | 확인 결과 |
| --- | --- |
| 사용자 지정 소유자 / 이름 | `Jebipro/agent-eval-lab` |
| 지정 공개 범위 / 기본 브랜치 | Public / `main` |
| 예정 URL | https://github.com/Jebipro/agent-eval-lab — 아직 생성 완료 URL이 아님 |
| 원격 조회 | 인증된 읽기 전용 조회에서 HTTP 404. 이번 작업에서는 생성하지 않음 |
| GitHub CLI 인증 | `Jebipro` 인증 정상. sandbox 내부 실패 표시는 네트워크 제한 밖에서 재확인하여 해소 |
| 현재 브랜치 | `master`, unborn HEAD. 사용자 브랜치 커밋 없음 |
| remote / staged / 신규 commit | 없음 / 없음 / 없음 |
| 공개·최초 push | **NOT RUN**, 사용자가 준비 결과 검토 후 별도 승인하기로 함 |

로컬 Codex snapshot refs는 존재하며 그대로 보존했다. 이는 공개할 사용자 브랜치 이력이 아니다. 승인 후 `main`의 최초 커밋과 해당 브랜치만 명시적으로 push해야 한다. `--mirror`, `--all`, 내부 refs push, force push 또는 기존 이력 삭제는 사용하지 않는다. 최초 커밋 SHA와 실제 원격 기본 브랜치는 아직 없다.

현재 Git 설정의 개인 이메일은 공개 커밋에 사용하지 않는다. 승인 후 최초 커밋에는 확인된 계정 ID 기반 `182050296+Jebipro@users.noreply.github.com`을 명령별 설정으로 사용할 계획이다. 전역/저장소 identity 설정은 이번에 바꾸지 않았다.

## 2. 보안·개인정보 및 파일 점검

- 공개 후보 파일의 인증정보 패턴, 개인 홈 절대 경로, 환경/설정 파일, 큰 파일과 캐시를 점검했다. API token, private key 또는 실제 password 값은 발견하지 않았다. 패턴 검색과 파일 검토의 결과이며 모든 형태의 비밀정보 부재를 수학적으로 보증하지는 않는다.
- 예제 JSON 네 개(`forbidden-file`, `success-no-git`, `test-failure`, `type-error`)의 stdout에 로컬 사용자명/임시 절대 경로가 있었다. 공개를 보류하고 해당 경로만 `<project>`로 치환했다. 원래 시간·run ID·검사 결과·점수는 보존했다. 개인 경로 자체는 이 문서에 재기록하지 않는다.
- `scripts/examples.mjs`가 앞으로 만드는 JSON 문자열/terminal에도 native 및 `/` 형식 fixture/source 경로를 치환하도록 최소 보완했다. 일반적인 secret scanner를 제품에 추가한 것은 아니다.
- 공개할 브랜치 이력은 아직 없다. 기존 로컬 snapshot에는 위 익명화 전 예제 경로가 있으므로 내부 refs는 공개 대상에서 제외한다. 로컬 이력 자체를 삭제하거나 다시 쓰지 않았다.
- `.gitignore`에 `.env`, `.env.*`(공유용 `.env.example` 예외), `.npmrc`, logs, `.ci-results`, TypeScript cache 및 OS 임시 파일 제외를 보완했다. 기존 node_modules/dist/coverage/tarball/평가 결과 제외를 유지했다. ignore 규칙은 이미 추적된 파일을 보호하지 않으므로 최초 stage 후 다시 확인해야 한다.
- 후보 파일은 약 0.35 MB 규모이며 최대 개별 파일은 약 55 KB의 루트 package-lock.json이다. node_modules, dist, tarball, 임시 검증 로그, 개인 설정은 게시하지 않는다. 첨부 마스터 프롬프트는 저장소 밖에서 읽었고 업로드 목록에 추가하지 않았다.
- `src/`, `tests/`, lockfile, 기존 감사·수정·검증 보고서는 수정하지 않았다. 기존 TTY JSON은 snapshot과 줄 종료 표현에 차이가 있지만 데이터는 같으며 이번 작업에서는 변경하지 않았다.
- 감사 원본 SHA-256: `5D860C29616E5DCD4D96177DAC45F69C97B62320AB3800D17E1C6CD63B25D03A`.

## 3. README와 패키지 메타데이터

README에서 목적, v0.1 범위/제외 기능, Node 22.12+, 게시 후 npx Quick Start, 현재 로컬 tarball 사용법, 개발 설치/테스트, CLI/종료 코드, JSON 예시, 제한/보안/라이선스 및 문서 링크를 확인·보완했다. Linux/Node 22를 검증 완료로 표시하지 않는다. 초기 `verification.md`의 59개 통과 결과와 최신 remediation의 89개 통과 결과를 역사적 기록으로 구분한다.

`repository`, `homepage`, `bugs`는 사용자가 지정한 실제 공개 대상 URL로 설정했다. 아직 저장소가 생성되지 않았음을 README에 명시했다. `license: MIT`, `bin: dist/cli/index.js`, npm files allowlist 및 prepack build는 유지했다. dependency, 버전 및 CLI/보고서 계약은 변경하지 않았다. 빌드 산출물은 Git에서 제외하고 CI와 prepack에서 생성한다. 패키지 소비자에게 소스 build를 요구하지 않는다.

## 4. GitHub Actions 구성

기존 네 가지 조합과 모든 검증 단계를 유지했다. `push`, `pull_request`, 수동 dispatch를 지원하며 각 job 제한은 20분이다.

| OS | Node | 실제 원격 결과 | run URL / SHA |
| --- | --- | --- | --- |
| windows-latest | 22 | **NOT RUN** | 없음 — 최초 push 승인 대기 |
| windows-latest | 24 | **NOT RUN** | 없음 — 최초 push 승인 대기 |
| ubuntu-latest | 22 | **NOT RUN** | 없음 — 최초 push 승인 대기 |
| ubuntu-latest | 24 | **NOT RUN** | 없음 — 최초 push 승인 대기 |

각 job은 `npm ci` → strict typecheck → 전체 `npm test` → build → pack dry-run → `npm run test:package`를 실행한다. 소비자 검증은 정상 `npm pack`/prepack, 저장소 밖 설치, 설치된 bin, 성공/실패/오류/JSON 일관성을 검사한다.

공식 [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)의 확인된 전체 commit SHA를 사용한다. `contents: read`, checkout credential persistence 비활성화, npm cache 사용, 별도 secrets 없이 동작한다. GitHub-hosted runner 대상이며 자체 runner 호환성은 주장하지 않는다.

명시적 bash의 pipefail로 실패 종료 코드를 유지하면서 단계별 로그와 JUnit XML을 저장한다. artifact는 실패 시에도 업로드하며 보존 기간은 14일이다. hidden 디렉터리에서는 명시한 로그/XML과 새 package record만 수집한다. checkout에 있던 과거 package record를 job 시작 시 제거하므로 패키지 검증이 실행되지 않았는데 과거 PASS 기록이 새 artifact로 올라가는 것을 막는다. `continue-on-error`나 테스트 삭제로 통과시키지 않는다.

OS 조건 제외: Windows에서는 POSIX signal 및 탭 파일명 2개를 제외한다. Linux에서는 Windows batch 실행 2개, 제한 PATH cleanup 2개, taskkill fault/cleanup 6개 등 Windows 전용 10개를 제외하도록 기존 테스트가 정의돼 있다. 따라서 현재 suite의 예상 분기는 Windows 89/2, Linux 81/10(통과/제외)지만 **Linux 수치는 정적 예상이지 실제 PASS가 아니다.** 실제 job 결과와 비교해야 한다.

## 5. 실제 로컬 검증과 보존한 증거

| 항목 | 결과와 근거 |
| --- | --- |
| 기존 최종 전체 suite | **PASS: 89 passed / 2 skipped / 0 failed, 8개 파일, 95.23초**. 보존된 full-test.log 확인, src/tests 변경 없음. 이번에 전체 suite를 반복하지 않음 |
| 기존 strict typecheck / TTY | remediation 기록과 관련 증거 확인. Windows TTY 성공 0, 실제 Ctrl+C native 130. 원격 CI 증거로 사용하지 않음 |
| CI JUnit 옵션 | 기존 score 단위 테스트 **3개 PASS**, JUnit XML 생성. 전체 suite에 새 테스트를 추가한 수치가 아님 |
| workflow | YAML 파싱, 4개 matrix, 권한, timeout, 공식 SHA 고정 확인. 원격 runner에서 실행한 결과는 아님 |
| 공개 예제 | 기존 7개 JSON schema 확인. 독립 임시 소스 복사본에서 생성 스크립트의 7개 실제 시나리오와 경로 치환 검증; 저장소의 과거 예제 결과/시간은 재생성하지 않음 |
| 현재 README/metadata 포함 build/pack/소비자 | **PASS**, 2026-10-19 16:17:53 KST 완료. `npm run test:package` 종료 0, 정상 prepack build 포함 |
| 새 소비자 세부 결과 | production-only 설치, help/version/init/run, assertion 실패 1, 실행/설정 오류 2, schema, JSON stdout/파일 일치, source/dev runner 불필요 모두 통과 |

새 패키지 기록은 [publication-package-verification.json](publication-package-verification.json)에 따로 저장했다. 이전 `package-verification.json`과 REMEDIATION_REPORT의 수치/과거 tarball 해시는 변경하지 않았다. 새 tarball은 36개 파일이며 SHA-256은 `9E3F308A7C8E6B0D1A66EBA604A2699FEC54DA2A23120C89528307D639869DF4`이다. 소비자 설치 5,850ms, fixture dependency 설치 5,261ms, 준비된 init/run/읽기 5,093ms였다. npm offline warm cache를 사용했으며 registry 공개 설치 또는 cold-cache 검증은 아니다.

로컬 검증 중 sandbox의 junction 생성/임시 파일 rename EPERM은 허용된 환경에서 재실행해 해소했다. 임시 검증 복사본의 package version 누락과 익명 임시 basename을 경로로 오인한 검증 조건을 바로잡았다. 제품 결함으로 확정된 문제가 아니며 프로덕션 코드는 수정하지 않았다. 원격 실행이 없으므로 새 크로스 플랫폼 결함 발견/수정도 주장하지 않는다.

## 6. 승인 후 절차와 아직 남은 작업

1. 사용자가 아래 게시 파일 및 점검 결과를 검토하고 Public 저장소 생성·최초 push를 명시적으로 승인한다.
2. 승인된 파일만 stage하고 staged 내용/경로/비밀정보, 개인 이메일 노출 여부를 다시 검토한다. `main` 최초 커밋을 만들고 허가된 저장소를 생성하거나 상태를 재확인하여 연결한다. 내부 refs를 보내지 않는다.
3. `main`만 push한 뒤 실제 기본 브랜치, Public 여부, README/주요 파일 표시를 확인한다. 결과 URL과 commit SHA를 이 문서에 기록한다.
4. 해당 최신 SHA의 4개 Actions job을 실제 확인하고 PASS/FAIL/BLOCKED를 기록한다. 실패 로그를 분석하고 필요한 최소 수정만 정상 커밋으로 반영한다. 수정 후 과거 SHA의 PASS를 최신 결과로 재사용하지 않는다.
5. npm 게시 전에는 네 환경 CI, 계정/이름 사용 권한, 최신 tarball 내용과 라이선스/metadata, 승인된 게시 절차를 확인한다. npm publish 또는 GitHub Release는 이번 요청 범위에 포함되지 않는다.

**현재 판정:** GitHub 공개 준비는 완료했으나 실제 공개는 NOT RUN(승인 대기), 원격 CI 네 개 모두 NOT RUN이다. Windows 로컬 패키징/소비자 검증은 PASS다. npm의 전체 플랫폼 배포 검증 완료라고 선언할 수 없다. EXT-001, sandbox 부재, Git 비원자적 snapshot, 미지원 index/filter 안전 오류 등 기존에 문서화한 제한은 유지한다.

## 7. 최초 업로드 예정 파일

아래 목록만 게시 대상으로 검토했다. 아직 stage/commit하지 않았다. node_modules, dist, `.ci-results`, `.agent-eval`, coverage, tarball, 개인 설정과 로컬 내부 Git refs는 제외한다.

총 **65개 파일**.

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

