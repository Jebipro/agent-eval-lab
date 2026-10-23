# JSON Report Viewer v0.1 구현 계획

작성일: 2026-10-20. **아래 모든 구현·테스트·배포 단계는 계획이며 미실행이다.** 이번 작업은 기존 파일 분석과 지정된 설계 문서 3개 작성으로 끝낸다. [요구사항](VIEWER_REQUIREMENTS.md)과 [아키텍처](VIEWER_ARCHITECTURE.md)를 함께 적용한다.

## 1. 실행 원칙과 현재 근거

- 기존 CLI schemaVersion=1, 소스, 테스트, package.json/lockfile 및 역사적 검증 문서를 보존한다.
- 후속 구현은 `viewer/`의 독립 private package와 전용 테스트로 수행한다. 루트 runtime dependencies나 npm 파일 allowlist를 확장하지 않는다.
- 첫 구현 전에 현재 변경 상태와 파일 해시를 기록한다. 이미 존재하는 미커밋 mini-lang 보고서·실험 자료를 새 작업 결과로 오인하거나 덮어쓰지 않는다.
- 테스트 fixture의 ‘실제 실행 사본’과 ‘UI/보안용 합성 데이터’를 manifest로 구분한다. 합성 report의 시간/UUID/상태를 실제 CLI 실행 증거라고 부르지 않는다.
- 샘플 검토·독립 소비자/CLI 보존 검증을 완료한 뒤에만 배포를 요청한다. 현재는 Git commit/push, Pages, npm 게시 승인이 없다.

현재 확인한 실제 report는 기존 예제 7개 + mini-lang 4개다. 읽기 분석 및 현재 reportSchema 검사에서는 11개 모두 통과했다. Viewer로 열어 확인한 것은 아니며, 문서의 PASS는 mini-lang 과거 실행 근거를 설명하는 경우를 제외하면 앞으로 확보할 완료 조건이다.

## 2. 6단계 구현 순서

| 단계 | 작업 | 단계별 테스트 | 완료 조건 |
| --- | --- | --- | --- |
| 1. 경계·계약·fixture 준비 | 구현 승인 확인, viewer 전용 package/lock/config, 버전 호환성 pin, canonical validator 생성, type-only bridge, 공개 후보와 비공개 테스트 fixture 분리 | viewer 단독 clean install/build, schema 해시·생성물 일치, 기존 11개 fixture 구조 검증, root 변경 diff 검사 | 루트 package/lock/CLI 변경 없이 기본 빌드 가능. 모든 필요한 fixture가 존재하거나 명시적인 확보 작업이 등록됨 |
| 2. 안전한 Import | File/drop, Worker, version gate, JSON/UTF-8/schema/resource 오류, request ID/취소/닫기, 순수 adapter | 파서·validator 단위, malformed/누락/추가 필드/크기 경계, worker deadline·연속 선택·실패 후 이전 report 잔존 테스트 | 유효한 report만 ready로 전환. 실패는 원인별 안내. 입력이 DOM/console/저장소/network에 새지 않음 |
| 3. 핵심 결과 화면 | Overview, Checks, Git, 진단, 상태 설명, 페이지 단위 로그·literal 검색 | mini-lang 4개와 기존 오류 예제를 통한 컴포넌트 테스트, null/optional 구분, 수치·상태·경로 assertion | 전체 판정·점수 재계산 없이 모든 필드 정확 표시. mandatory/optional, 평가 오류/Import 오류 구분 |
| 4. 샘플·반응형·접근성 | 검토된 샘플 picker, 개인정보 안내, 시스템/라이트/다크, 320px~1440px, keyboard/focus | Testing Library role/name, 키보드 파일 선택/검색/닫기, 확대·모바일, 샘플/로컬 전환, 대비·aria-live | P0 기능을 마우스 없이 사용 가능. 네 실전 예제와 추가 오류 사례를 쉽게 열 수 있음. 샘플 공개 적합성 승인 전에는 배포 금지 |
| 5. 보안·통합·CLI 보존 | production CSP, XSS/외부 전송/큰 입력/검색 테스트, Playwright Chromium/Firefox/WebKit, 번들 검사 | 아래 테스트 매트릭스, base-path preview, gzip 측정, 루트 기존 tests/typecheck/build/test:package | P0 테스트 전부 PASS, 미검증 항목 공개 기록. Viewer가 CLI tarball에 들어가지 않고 기존 동작 유지 |
| 6. CI·승인 후 정적 배포 | 별도 Viewer CI, main workflow_dispatch Pages 배포, 최소 권한·동일 SHA gates, 운영 문서 | Viewer CI와 기존 CLI Windows/Ubuntu×Node22/24, artifact allowlist, 별도 승인 후 실제 Pages smoke test | 승인한 SHA의 CI 성공·하위 경로 동작·로컬 파일 privacy 확인. 실제 배포 URL과 결과 기록 |

1→2→3→4→5→6 순서다. 보안은 마지막에 덧붙이지 않고 2단계부터 반영한다. 6단계의 workflow 작성과 실제 Pages 활성화/배포는 별도 행위이며, 환경 권한/사용자 승인이 없으면 로컬·CI 준비까지 완료한 사실과 미배포 상태를 분리 보고한다. 이번 설계 종료를 구현 승인으로 간주하지 않는다.

## 3. mini-lang 실전 fixture의 정확한 기대값

파일 접두 경로는 `docs/experiments/mini-lang-2026-10-20/`다. 현재 공유용 사본은 보존하고 Viewer에 넣을 때 별도 공개 사본과 manifest를 만든다.

| ID / 실제 파일 | Overview / Checks | Git / 보호 검사 | 오표시 방지 |
| --- | --- | --- | --- |
| M1 `normal.json` | passed/0, score=100, complete=true, pass=3,total=3. tests/typecheck/explicit-any 모두 pass | base SHA `9558e041…`, yaml untracked 1개, stats incomplete=true | 258개 testcase를 total로 만들지 않음. Git 줄 수 null을 0으로 표시하지 않음 |
| M2 `test-failure.json` | failed/1, score=67, pass=2,fail=1,total=3. tests exit=1, 다른 두 검사 pass | yaml+tests/source.test.ts, tracked +1/-1 | reason과 stderr에서 INTENTIONAL_AEL_FAILURE 확인. 257/258 비율로 점수를 바꾸지 않음 |
| M3 `forbidden-change.json` | failed/1, score=75, pass=3,fail=1,total=4. command 세 개 pass | package.json M +2/-1, forbidden-files fail, violation path=package.json/pattern=package.json, 개별 exitCode=null | ‘테스트 실패’로 부르지 않고 ‘보호 규칙 위반’ 표시. 모든 설정 규칙을 추정하지 않음 |
| M4 `restored.json` | passed/0, score=100, pass=4,total=4. 보호 검사도 pass | yaml만 남음, violations=[] | M1과 동일 100점이어도 분모 4/3 차이를 유지. 자동 개선 점수 비교 없음 |

공통 검증: tool.version=0.1.0, schemaVersion=1, optional=0, errors/warnings=[], git.timing=before-commands, scoreComplete=true와 stats.incomplete=true를 동시에 표시한다. stdout/stderr는 plain text로 읽고 `<experiment>`를 문자 그대로 보인다. origin 파일 SHA와 공개 사본 SHA를 기록하고 추가 익명화가 있으면 변경 필드와 이유를 남긴다.

## 4. 추가 의미·Import 테스트

| ID | 사례 / 현재 확보 상태 | 확보 방법 또는 사용 파일 | 반드시 보일 결과 |
| --- | --- | --- | --- |
| E1 | 실행 오류 / 있음 | examples/reports/execution-error.json | error/2, 0점 불완전, error check. 최상위 errors=[]여도 error 유지 |
| E2 | timeout / 있음 | examples/reports/timeout.json | error/2, timedOut=true, reason, 불완전 점수. signal=null을 임의 생성하지 않음 |
| E3 | Git 비활성 / 있음 | examples/reports/success-no-git.json | passed/0, 2/2, 100. Git disabled, 보호 PASS 제조 금지 |
| E4 | TypeScript 종료 2 / 있음 | examples/reports/type-error.json | check fail/exit2, 전체 failed/1. exit 숫자만으로 error로 재분류 금지 |
| E5 | 설정 오류·score=null·git=null / 독립 예제 없음 | 후속 임시 프로젝트에서 공개 CLI 0.1.0과 version=99 YAML로 run --json stdout 캡처. 기존 파일 보호 오류는 별도 경우 | error/2, 점수 미산정, checks=[], Git 결과 없음. 정상적인 report Import로 처리 |
| E6 | 취소 / 독립 예제 없음 | 후속 격리 fixture의 장기 명령을 실제 SIGINT/Windows TTY Ctrl+C로 중단해 stdout JSON과 프로세스 130 확인. 실패/환경 불가 시 합성 UI fixture로만 검증하고 실제 실행 미검증 명시 | cancelled/130, skipped 이유·미실행 검사, 불완전 점수. CLI에 없는 cleanup 성공을 추정하지 않음 |
| E7 | 선택 검사 실패 / 독립 예제 없음 | 임시 config에서 통과 2개+required:false 실패 1개를 공개 CLI로 실행. UI 단위용 합성도 별도 라벨 | passed/0, 67점, optionalFailures=1. 전체 passed와 check fail 공존 허용 |
| E8 | 선택 실행 오류/필수 skipped / 독립 예제 없음 | UI 합성 fixture 및 기존 tests/unit/score.test.ts의 의미를 참고. 실제 실행 샘플로 부르지 않음 | error/2, scoreComplete=false, 선택 오류를 무시하지 않음 |
| E9 | 전역 오류·저장 오류 / 독립 예제 없음 | UI용 합성 report; 실제 확보 시 쓰기 실패 출력과 파일 불일치도 기록 | checks pass여도 overall error 유지. Viewer는 파일이 최신 실행인지 단정 불가 |
| E10 | malformed/UTF-8 오류/빈 파일 / 없음 | 테스트에서 바이트·문자열 생성. raw JSON fixture는 정상 report와 별도 폴더 | DecodeError/ParseError. 데이터 조각이 포함된 native exception을 그대로 노출하지 않음 |
| E11 | 숫자 version=2 / 타입·구조 오류 / 없음 | 정상 fixture의 비공개 테스트 복사본 변형 | 2=UnsupportedVersion; 누락/문자열1/필수 필드 누락/extra property/enum 오류=SchemaError |
| E12 | summary 불일치/중복 id / 없음 | 구조적으로 유효한 합성 데이터 | 일관성 경고와 기록된 값 보존, React 항목 누락 없음. 임의 정상화 금지 |
| E13 | optional 필드 누락·빈 로그·exitCode null / 일부 있음 | 기존 forbidden 사례 + 추가 합성 | 미제공/빈 출력/종료 코드 없음을 구분. 없는 stdout 생성 금지 |
| E14 | binary/rename/untracked/알 수 없는 Git 상태 / 일부만 있음 | untracked는 M1; 나머지는 합성 test fixture, 필요 시 격리 Git로 실제 확보 | oldPath 보존, binary 표시, null 줄 수, 원래 status 유지 |
| E15 | 로그 잘림 / 독립 예제 없음 | outputTruncated=true 합성 fixture. 실제 공개 CLI의 긴 출력 fixture는 후속 확보 가능 | CLI 잘림과 Viewer 표시 구간 분리를 명확히 함 |

설정 오류는 원래 CLI가 파일을 저장하지 않으므로 stdout 캡처를 fixture로 보존해야 한다. 기존 release report의 검증 기록이나 단위 테스트 존재를 E5/E6 독립 JSON 파일의 존재로 대신하지 않는다. 손상 JSON/공격 문자열은 실행 결과를 조작한 ‘실전 사례’로 소개하지 않는다.

기존 execution-error.json의 stderr에는 깨진 문자 `�`가 실제로 있다. Viewer는 이를 추측 복구하거나 번역하지 않고 원문 그대로 안전하게 표시한다. 사용자 파일 자체의 유효하지 않은 UTF-8 bytes와 이미 JSON 안에 들어 있는 유효한 `�` 문자는 다른 테스트다.

## 5. 보안·성능·접근성 테스트

| ID | 검증 | 합격 기준 |
| --- | --- | --- |
| S1 XSS | project.name, filename, reason, 로그, Git path, 진단 hint에 HTML/script/SVG/이벤트 payload 삽입 | 문자로만 보임. alert/DOM 삽입/새 network 요청 없음 |
| S2 속성·prototype | javascript:/data:/file: URL, `__proto__` 등 추가 키, 악성 id·경로 | 자동 링크/실행/객체 merge 없음. 추가 키는 계약대로 거절, 검증 전도 prototype 오염 없음 |
| S3 개인정보 네트워크 | sentinel secret를 포함한 파일 Import→검색→닫기. Playwright의 모든 request URL/body 관찰 | 파일/이름/검색어/sentinel가 요청에 없음. 앱/검토된 샘플 asset만 허용; fetch/XHR/beacon/WebSocket 없음 |
| S4 보관 | Import/오류/테마 변경 후 storage·console 검사, 새로고침 | 보고서·로그·검색어 local/session storage, IndexedDB, Cache Storage, console에 없음. 새로고침 후 report 복원 안 됨 |
| S5 용량 | 10 MiB 경계/초과, 깊이 64/초과, 노드/검사/변경 수 한도, 수 MiB 한 줄 | 읽기 전 크기 거절 또는 Worker 한도 오류. UI가 계속 취소/새 입력에 반응. 스키마 오류로 오표시하지 않음 |
| S6 경쟁 상태 | 큰 A 선택 후 B, 취소, 닫기, 잘못된 C, 같은 파일 재선택 | 마지막 선택만 표시. 이전 report/로그/검색 결과 잔존 없음 |
| S7 로그 검색 | 문자 `<`, 한글, 줄바꿈, bidi/ANSI, 256자/초과 검색어, 1,000개 초과 일치 | 정규식 해석 없음. 안전한 highlight, 검색 한도/표시 변환 안내, 초장문에도 UI 반응 |
| S8 CSP | production artifact를 하위 경로로 서빙, 엄격 CSP 적용 | unsafe-eval/inline 요구 없음. 정상 앱/Worker/샘플 정상 작동. CSP 위반 수집은 외부 전송 안 함 |
| A1 키보드/보조 기술 | 파일 선택, 샘플, 탐색, 로그 펼치기/검색, 닫기, 오류 후 focus | role/name/label, visible focus, focus trap 없음, aria-live, 색상만으로 상태 구분하지 않음 |
| A2 반응형 | 320/375/768/1440px, 200% 확대, 라이트/다크 | 잘린 필수 텍스트 없음, 본문 가로 overflow 없음, 코드 영역만 필요 시 스크롤 |
| A3 실제 브라우저 | Chromium/Firefox/WebKit 자동 E2E + 실제 iOS Safari/Android Chrome 파일 선택 smoke test | 실행한 브라우저/버전 기록. WebKit 에뮬레이션만으로 실제 iOS 확인을 대신하지 않음 |
| P1 번들/시간 | production gzip, 11개 실제 fixture 및 경계 입력 측정 | 초기 JS/CSS 250KiB 목표, 일반 수 KiB fixture 표시 1초 목표, parsing worker 5초 제한. 측정 장비/조건 기록, 미측정은 PASS 아님 |

P1의 수치는 사전 목표다. 브라우저/장비에 따른 성능을 측정한 뒤 합의 없이 ‘검증 완료’로 바꾸지 않는다. 실제 모바일 접근이 없으면 해당 항목은 미검증으로 남긴다. CSP나 앱 코드가 신뢰된 호스트라는 전제도 결과에 명시한다.

## 6. CLI 보존·배포 검증

후속 구현 전후 root package.json/lockfile, `src/`, 기존 tests/fixture, report.schema.json, 감사/수정/실전 원본 문서 해시를 비교한다. 새 viewer 파일은 CLI의 dist로 빌드되지 않아야 한다. 기존 `npm test`, strict typecheck, build, `npm run test:package`와 실제 pack 목록으로 viewer/웹 의존성이 CLI 배포에 들어가지 않았음을 검증한다. 같은 source 버전이라는 이유로 새 UI가 있는 npm 패키지를 다시 게시하지 않는다.

Viewer CI에서는 독립 lockfile 기반 npm ci, validator 최신성 검사, typecheck, 단위/컴포넌트, 브라우저 E2E, production build/CSP/하위 경로 검사를 수행한다. CLI 네 환경 workflow는 그대로 유지한다. 실패를 조건 제외하거나 테스트를 삭제해 배포하지 않는다.

배포 준비 체크:

1. 사용자 승인된 main SHA인지, 같은 SHA의 Viewer 및 CLI 4개 CI 성공인지 확인.
2. 샘플 manifest/개인정보 검토 완료, dist 파일 목록에 raw 실험 폴더·로그·env·source map·비밀 값 없음 확인.
3. `viewer/dist`만 업로드, Pages 최소 권한·github-pages environment·concurrency 확인.
4. 별도 Pages 활성화/배포 승인 후 workflow_dispatch 실행.
5. 실제 `/agent-eval-lab/`에서 새로고침/샘플/로컬 파일/로그/Worker/CSP/모바일 검사. URL·배포 SHA·CI URL 기록.
6. 실패 시 원인과 실제 공개 상태를 보고하고 이전 검증 artifact로의 수동 복구를 검토한다. 임의 npm 버전 상승·CLI 계약 변경을 해결책으로 사용하지 않는다.

## 7. 예상 위험과 결정 대기

| 위험 | 대응 / 결정 시점 |
| --- | --- |
| v1 타입·JSON Schema가 달라질 수 있음 | canonical 스키마 해시/생성 validator 체크. type-only bridge는 UI 개발 보조이며 런타임 검증을 대체하지 않음 |
| 대형 JSON/로그의 메모리 복제 | Worker 종료와 단일 활성 report, 페이지 렌더링. 실제 경계 성능을 5단계에서 검증 |
| CSP와 번들·Worker 로드 충돌 | production E2E로 확인; 무조건 unsafe-eval/inline 추가하지 않음 |
| GitHub 하위 경로 자산 404 | Vite base와 Worker/sample URL을 실제 preview 경로에서 테스트 |
| 공개용 사본에 민감정보 남음 | 자동 패턴+사람 검토, 원본과 별도 사본, allowlist build. 미검토 샘플은 배포 제외 |
| 보고서를 진실 인증으로 오해 | 기록된 값 표시임을 안내. 일관성 검사는 별도 경고이며 서명·현재 프로젝트 상태 인증 아님 |
| 기존 npm 배포에 웹 코드 혼입 | 독립 폴더·lock·dist, pack 검사, root tests 범위 보존 |

**구현 전:** 구현 승인과 viewer 전용 파일/개발 의존성 생성 범위를 확인하고 정확한 호환 버전을 고정한다. 한국어 UI·기본 프로젝트 Pages 경로·React 구조는 추천 기본값으로 결정했다. 다른 언어/도메인/스택을 원할 경우 구현 전에 변경한다.

**구현 중:** 실제 gzip/성능, 대상 브라우저의 Worker/CSP, 누락 실제 fixture 확보 가능성은 측정·검증으로 확정한다. 합성 UI 테스트와 실제 CLI 증거를 분리한다.

**공개 전:** 샘플 공개 내용과 Pages 배포·권한 설정은 별도 승인 대상이다. 이 문서 작성으로 commit/push/배포 권한이 새로 생기지 않는다.

## 8. 설계 단계 종료 기준

요청한 기존 파일과 실전 사례를 분석하고, 요구사항·기술 선택·보안 경계·6단계 계획 및 미결정 항목을 세 문서에 기록하면 이번 작업은 종료한다. Viewer 소스/테스트/package/lock/workflow는 지금 만들지 않고, CLI나 기존 예제·실전 기록도 변경하지 않는다. 다음 사용자 지시 전에는 1단계를 시작하지 않는다.
