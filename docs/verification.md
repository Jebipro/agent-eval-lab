# 검증 및 명세 완료 조건 대조

검증일: 2026-10-18 (Asia/Seoul). 기준: 사용자가 제공한 `AGENT_EVAL_LAB_MASTER_PROMPT.md` v0.1. 기존 구현을 유지하고 중단된 최종 검증을 이어서 수행했다.

**판정: v0.1 필수 구현과 Windows 로컬 검증 완료.** 원격 GitHub Actions, Linux 실제 실행, Node 22 실제 실행, 공개 npm 설치는 아직 검증하지 않았다. 공개 게시도 수행하지 않았다. 아래의 PASS는 명시된 범위에만 해당한다.

## 실행 결과

환경: Windows, Node v24.16.0, npm 11.13.0, Git 2.55.0.windows.5. 공백·한글 경로에서 검증했다.

| 명령 또는 시나리오 | 결과 | 근거 / 제한 |
| --- | --- | --- |
| `npm ci --no-audit --no-fund --fetch-retries=0` | PASS | 최종 lockfile로 57개 패키지 설치; 제품 동작을 바꾸는 옵션 없음 |
| `npm run typecheck` | PASS | TypeScript strict, 종료 0 |
| `npm test` | PASS | 6개 테스트 파일; 59 통과, 2 OS 조건 제외, 실패 0; 53.59초 |
| `npm run build` | PASS | tsc, 실행 권한 설정, 보고서 JSON Schema 생성; 종료 0 |
| `npm pack --dry-run` | PASS | 배포 allowlist 확인; 32개 파일, README/LICENSE/compiled JS/schema 포함 |
| `npm run test:package` | PASS | 정확한 로컬 tarball을 저장소 밖 새 소비자 폴더에 설치하고 설치된 bin 실행 |
| 소비자 소스/개발 의존성 독립 | PASS | `--omit=dev`, src/TypeScript 미설치, install/postinstall/prepare build hook 없음; compiled imports의 소스·개발용 로더·외부 상대 경로 참조 검사 |
| 소비자 help/version/init/run | PASS | 실제 npm/TypeScript/Vitest fixture, 별도 `npm ci`, 성공 종료 0 |
| 소비자 실패/오류/JSON | PASS | 실제 assertion 실패 1, 실행 파일 없음 2, 설정 오류 2, JSON Schema 검증 및 stdout/파일 객체 동일성 |
| 준비된 fixture의 2분 UX | PASS | 최종 5.665초; 소비자 설치 8.255초, fixture 의존성 설치 6.144초는 별도; [기록](package-verification.json) |
| 실제 TTY init | PASS | 직접 확인 입력 후 생성 및 프로세스 종료 0 |
| 실제 TTY 설정 없는 run | PASS | 초기화 동의 → 명령 확인 → 설정 생성 → 평가 성공, 종료 0 |
| 실제 TTY Ctrl+C | PASS | native Node 자식 종료 130, cancelled, 2개 skipped, scoreComplete=false; [기록](tty-verification.json) |
| 비대화형 CLI | PASS | non-TTY, `--json`, `--non-interactive`, 소비자 CI=true 흐름에서 입력 대기 없음 |
| 실제 샘플 7개 생성 | PASS | 성공/Git 없음, assertion 실패, tsc 오류, forbidden 변경, executable 오류, timeout, 추가 requirements 명령 |
| Linux 전용 자동 테스트 | NOT RUN | 탭 파일명, POSIX signal 종료 2건은 Windows에서 의도적으로 제외 |
| Linux/Windows 원격 CI 및 Node 22 | NOT RUN | matrix 정의만 완료; 원격 저장소/CI 실행 없음 |
| 공개 registry 첫 다운로드 | NOT RUN | npm 캐시 허용 로컬 tarball 검증; cold-cache 설치 시간으로 주장하지 않음 |
| GitHub 공개 / npm publish | NOT RUN | 별도 게시 요청·대상 없이 수행하지 않음 |

최신 패키지 설치 시간, fixture 의존성 준비 시간, init/run 시간, tarball 전체 파일 목록과 실제 terminal 출력은 [기계 판독 기록](package-verification.json)에 있다. npm 이름 조회는 E404였으며 이름 예약·소유권·게시 가능성을 보장하지 않는다.

## 명세 21절 완료 조건 — 20개 항목

| # | 완료 조건 | 판정 | 구현 / 검증 근거 |
| --- | --- | --- | --- |
| 1 | TypeScript/Node CLI build 및 설치 bin 실행 | PASS | build, 설치된 `.bin/agent-eval-lab` help/version/run |
| 2 | 소비자가 도구 clone/build 없이 사용 | PASS | 독립 소비자 tarball 설치, production dependencies만 사용 |
| 3 | init 실제 감지 및 유효 YAML 생성 | PASS | detect 테스트, 실제 TTY 및 소비자 init |
| 4 | TypeScript/Vitest/npm 기본 흐름 | PASS | 실제 작은 fixture의 test/typecheck 성공 |
| 5 | interactive / non-interactive 구분 | PASS | 실제 TTY와 자동 CLI/CI=true 검증 |
| 6 | 준비된 프로젝트 첫 결과 UX·시간 | PASS | `test:package` 120초 미만 assertion과 실측 기록 |
| 7 | 테스트·타입·추가 명령의 실제 결과 | PASS | 실제 assertion, tsc, requirements script 실행 |
| 8 | fail/error/skipped 및 종료 코드 | PASS | 자동 테스트 0/1/2, 실제 Ctrl+C native exit 130 |
| 9 | Git 기준·범위 및 forbidden | PASS | base SHA, staged/unstaged/untracked, rename/delete/binary, nested scope, 복구 중복 회귀 테스트 |
| 10 | terminal 및 동일 JSON 결과 | PASS | 하나의 결과 객체를 save/renderer가 사용, 소비자 파일 동등성 확인 |
| 11 | JSON 단독 출력 및 실패 파싱 | PASS | 자식 로그/ANSI 혼입 없음, 초기 오류도 같은 envelope |
| 12 | 명세의 score·미완료 처리 | PASS | 반올림, 선택 검사 분모, 오류 우선순위, skipped, null score 테스트 |
| 13 | core/report/terminal/save 분리 | PASS | `src/core`, browser-safe report types/schema, 별도 renderer/serializer/writer |
| 14 | 성공/실패/오류 fixture·실제 예제 | PASS | fixture 및 `examples/reports` 7개 실제 보고서 |
| 15 | typecheck/test/build/tarball 실행 | PASS | 위 실행 결과 및 소비자 검증 기록 |
| 16 | Linux/Windows CI 정의 및 실검증 구분 | PASS | Node 22/24 × 두 OS matrix; 원격 CI는 명시적으로 NOT RUN |
| 17 | README 첫 화면 일반 사용자 Quick Start | PASS | 게시 후 두 npx 명령과 현재 로컬 tarball 경로를 구분 |
| 18 | 배포 가능한 metadata/deps/bin/files | PASS | package.json, shebang, chmod, allowlist, 실제 npm pack/install |
| 19 | 범위 밖 기능 미추가 | PASS | 웹/Viewer/서버/DB/인증/LLM/API 호출/에이전트 실행 없음 |
| 20 | 게시·npm 이름 상태의 사실 기록 | PASS | 미게시, 원격 없음, E404 조회를 소유권 주장과 구분 |

## 명세 전체 범위 대조

| 명세 절 | 대조 결과 |
| --- | --- |
| 1–3: 임무·제품 방향·질문 | 빈 저장소에서 CLI로 구현; 기존 파일 재작성 없음; 설정된 검사의 증거만 보고 |
| 4–6: UX·CLI·감지 | 두 단계 흐름, TTY/non-TTY, --yes/--force, 경로 기준, safe single-run Vitest, npm만 자동 지원 |
| 7: 설정 | YAML + 엄격한 스키마, field-path 오류, 최소 1개, 고유/예약 id, default, 유한 양의 정수 timeout |
| 8: 실행 | 순차 실행, 실패 이후 계속, cwd/env 상속, bounded logs, error/timeout/cancellation cleanup, shell 문자열 조합 없음 |
| 9: Git | 시작 시 commit resolve, before-command snapshot, 최종 내용, ignored/출력 제외, NUL parsing, old/new rename forbidden, 읽기 전용 |
| 10–12: 판정·보고 | 동일 가중치, optional/error/skipped 규칙, 초기 오류 envelope, JSON-only, atomic replacement, 기존 source/config 보호 |
| 13–14: 구조·배포 | 단일 strict TypeScript ESM 패키지, compiled bin, runtime deps, files allowlist, 실제 외부 소비자 테스트 |
| 15–17: fixture·검증·CI | 실제 시나리오 7종, 필수 테스트 영역, 두 OS matrix, 실패에도 artifact 보존하는 소비자 workflow 예제 |
| 18–20: 문서·절차·명령 | 영어 README, architecture/schema/release 문서, 지정 scripts 실제 실행, 실패 수정 후 재검증 |
| 21–23: 완료·금지·보고 | 20개 조건 개별 대조, 미실행 사항 구분, 공개 작업 없음, 한국어 최종 보고 |

## 재개 후 보완 사항

- 중단된 세션의 결과를 복구할 수 없어 전체 테스트와 TTY 검증을 재실행했다.
- Windows raw-mode 권한 오류를 피하는 기존 line-oriented prompt 보완을 실제 콘솔에서 검증했다.
- staged 삭제 후 같은 파일을 디스크에 복구하면 deletion+untracked로 중복 집계되는 문제를 재현·수정했다. 원본과 같으면 변경에서 제외하고, 내용이 다르면 1개 수정 및 실제 줄 수로 집계한다. 사용자 index를 수정하지 않는다.
- staged rename 뒤 원래 경로를 복구한 경우도 최종 내용 기준으로 정규화한다. 원래 파일이 동일하면 새 경로의 추가만 기록하여 원래 경로에 대한 거짓 forbidden 위반을 방지한다.
- 큰 timeout이 Node의 타이머 한계를 넘을 때 1ms로 축소되지 않도록 긴 타이머를 나눠 예약했다. 명세대로 유한 양의 정수를 허용한다.
- 소비자 테스트가 디렉터리 존재 여부를 잘못 판정하지 않도록 access 검사를 사용하고, 실제 README 포함 및 소스/개발용 import 독립성 검증을 보강했다.
- 완료 조건 대조표, TTY 증거, 최신 패키지 기록을 추가했다. 기존 정상 기능의 대규모 리팩터링은 하지 않았다.

## 제한 및 공개 전 남은 작업

1. Linux/Node 22 및 GitHub 원격 matrix 결과가 없다. 전체 OS 지원을 확정하기 전에 실제 CI를 실행해야 한다.
2. cold-cache 공개 npm 다운로드와 registry 설치는 측정하지 않았다. 로컬 tarball 소비자 검증만 완료했다.
3. 명령은 신뢰하는 프로젝트에서 실행해야 한다. sandbox가 아니며 detached/reparented process 및 권한 경계에서는 cleanup에 OS 제한이 있다.
4. Git 수집은 동시 외부 변경에 대한 원자적 snapshot이 아니다. Git 출력/특수 복구 비교는 16 MiB, Git 호출은 15초 한계를 두고 초과 시 오류로 처리한다.
5. 자동 감지는 npm 중심이며 pnpm/yarn, 모노레포 전체 탐색, baseline 비교, 웹 Viewer는 범위 밖이다.
6. 실제 GitHub 대상/소유자 및 npm 계정 권한을 정한 뒤 저장소 URL metadata를 채우고 이름 사용 권한을 확인해야 한다. 현재 원격 URL/커밋/push/publish는 없다. 공개 저장소 생성·push·publish는 별도 승인 시에만 수행한다.

초기 sandbox 실행에서는 npm DNS ENOTFOUND, Vitest 임시 파일 rename EPERM, TTY raw mode EPERM이 발생했다. 필요한 실행을 허용된 환경에서 다시 수행했고 실제 통과 결과를 위에 기록했다. 원격 CI나 미실행 OS를 이 재실행으로 대체하지 않았다.
