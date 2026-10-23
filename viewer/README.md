# Agent Eval Lab Report Viewer

독립적인 비공개 개발 패키지다. 로컬 JSON의 파일 선택·Drag & Drop·교체·진행 상태·취소·닫기와 계약 검증, Overview·검사·Git 변경·진단 화면을 제공한다. Phase 4에서 일관된 디자인 토큰, 반응형 레이아웃, System/Light/Dark 테마와 로컬 체험 예제 후보를 추가했다. Examples 7개의 원문 공개는 사용자 승인 완료이며, Pages 배포·Git push·원격 CI 실행은 아직 별도 승인 대상이다.

기본 테스트·빌드는 공개 예제 7개와 합성 Fixture 8개만 사용한다. 미승인 mini-lang 자료는 필요하지 않다. 실제 기록은 Git 제외 폴더에 그대로 보존하며 **명시적인 로컬 명령**으로 같은 테스트 전체를 실행한다. 합성 시나리오는 실전 실행 결과가 아니다. 공개 테스트는 tests/fixtures/manifest.json, 승인된 체험 데이터는 samples/manifest.json에서 구분한다.

## 실행

이 저장소 전체 checkout과 Node.js 24 이상이 필요하다. Viewer는 루트 CLI와 별도 package.json/lockfile/node_modules를 사용한다.

```sh
cd viewer
npm ci
npm run dev
```

개발 서버의 `/agent-eval-lab/` 경로를 연다. UTF-8 JSON 하나를 선택하거나 점선 영역에 놓으면 검증한다. 새 파일 선택 즉시 이전 결과가 해제되며, 파일 선택 창의 취소는 현재 결과를 유지한다. 여러 파일·폴더·URL Drop은 거부한다. 확장자와 MIME만으로 파일을 거부하지 않고 내용을 검증한다.

진행 중에는 취소·닫기·교체가 가능하다. 취소/닫기는 Worker와 현재 파일명·보고서 참조를 해제한다. 읽기·UTF-8·구문·버전·스키마·자원·Worker 오류별 재시도 안내를 제공한다. 진행률은 실제 측정한 백분율이 아닌 진행 중 표시다.

Tab으로 파일 열기 이동 링크와 파일 선택·교체·취소·닫기를 이용할 수 있다. 검증 완료/오류는 상태 영역으로 포커스가 이동하며, 닫기/취소는 파일 선택으로 돌아온다. 상태는 aria-live로 알리고, 파일명은 길이를 제한한 안전한 텍스트로 표시한다. 평가 화면의 고정 링크로 Overview·Checks·Git·진단에 이동할 수 있다.

## 결과 읽기

상단의 화면 테마에서 System/Light/Dark를 선택한다. System은 운영체제 설정 변경을 반영하고 수동 선택은 이를 덮어쓴다. 선택은 현재 페이지 메모리에만 남으며 새로고침하면 System으로 돌아온다. 색상과 상태 텍스트를 함께 사용하고 키보드 포커스를 표시한다. 모바일에서 정보를 세로로 배치하며 긴 로그는 자체 스크롤 영역에서 읽는다.

체험 예제를 선택한 뒤 열기 버튼을 누르면 로컬 파일과 같은 Worker/스키마 검증 경로를 거친다. 공식 기록 4개와 합성 예제 3개만 로컬 후보로 제공한다. 출처·내용 해시·민감정보 검토·승인 상태는 [후보 manifest](samples/manifest.json)와 [공개 정책](samples/README.md)을 따른다. 예제의 로딩 실패나 5초 초과는 기존 결과를 지우고 재시도 안내를 표시한다. 새 선택·취소·닫기 이후 늦은 응답은 무시한다.

- Overview는 원본 프로젝트·도구·실행 식별·시각·시간·상태·종료 코드·점수·검사 요약을 표시한다. null 점수는 미산정, scoreComplete=false는 불완전 점수다. 검사 수는 Vitest testcase 수가 아니며 서로 다른 구성의 점수를 순위화하지 않는다.
- Checks는 id/label, 종류, 필수 여부, 상태·시간·종료 코드·사유를 표시한다. 검사 상세에서 실행 파일과 JSON 인자 배열, timedOut/signal/CLI 잘림, stdout/stderr, 위반을 확인한다. 명령을 실행하거나 shell 문자열로 합치지 않는다.
- Git은 결과 없음(null), 비활성(false), 활성(true)을 구별한다. 활성 snapshot의 기준 ref/SHA·수집 시각·명령 실행 전 시점·변경/이전 경로·상태·줄 수·binary·불완전 통계를 표시한다. null 줄 수는 알 수 없음이며 scoreComplete와 Git incomplete는 별개다.
- 평가 진단은 CLI errors/warnings와 Viewer 일관성 경고를 분리한다. Viewer는 checks와 summary 각 항목, 중복 id, 전체 status/exitCode 계약 조합만 점검한다. 점수·상태를 다시 계산하지 않으며 선택 실패+전체 passed, error+errors=[], 불완전 Git 통계를 모순으로 판단하지 않는다.

검사·변경·진단·위반 목록은 페이지당 최대 100개다. 로그는 기본 접힘이며 펼칠 때만 최대 32,768 UTF-16 원본 문자 구간을 렌더링한다. 일반 필드도 512자를 넘으면 전체 값을 페이지로 확인할 수 있다. 제어/방향 문자의 이스케이프는 표시 변환이며 원본을 수정하지 않는다. Viewer의 표시 구간은 CLI의 outputTruncated와 다르다.

로그 검색은 대소문자를 구분하는 일반 문자열 검색이다. 256 UTF-16 문자 제한, 200ms 대기, 65,536자 단위 처리 후 브라우저에 제어 반환, 최대 1,000개 일치 위치를 사용한다. 검색 한도 초과는 추가 일치 가능성으로 알리고 정규식은 실행하지 않는다. 이전/다음 일치 버튼과 페이지 이동을 키보드로 사용할 수 있다. 닫기·교체 시 펼침·페이지·검색 상태 및 대기 중 검색을 해제한다.

```sh
npm run typecheck
npm test
npm run build
npm run preview
npm run test:browser
```

브라우저 테스트의 기본 대상은 Playwright Chromium이다. 처음에는 `npx playwright install chromium`으로 브라우저를 설치한다(운영체제에 따라 시스템 라이브러리 설치도 필요). 설치된 Edge를 사용하려면 PowerShell에서 `$env:AEL_BROWSER_CHANNEL='msedge'`를 설정한 뒤 실행한다. 포트 4173의 production preview를 사용한다. 이번 실제 검증 환경은 Windows Edge이며 Chromium 별도 설치, Firefox/WebKit/Linux 검증을 대신하지 않는다.

Phase 4 브라우저 테스트는 axe-core 자동 접근성 검사, 네 가지 화면 너비, 테마·키보드·예제 전환, 실제 탭 200% 확대를 포함한다. 확대 검사는 테스트 결과 폴더의 별도 브라우저 프로필과 테스트 전용 확장을 만들고 `tabs.setZoom/getZoom`으로 확인한다. 제품에 확장이나 서비스 워커를 포함하지 않는다. 확장 실행을 막는 브라우저 정책이 있으면 해당 검사는 실패하며 skip하지 않는다. 스크린리더 직접 검증은 별도다.

Phase 5A의 호환성 실행은 별도 설정을 사용한다. 기존 Windows 검증은 Edge 67/67 통과, WebKit 63/66 통과 및 native select CSP 관련 3실패다. Chromium/Firefox는 Windows 실행 환경 차단으로 미검증이며 Linux CI 실행 전이다. 브라우저 설치 성공이 실제 실행 성공을 의미하지는 않는다.

```sh
npx playwright install chromium firefox webkit
npm run build
node scripts/run-tests.mjs public browser --config=playwright.compat.config.ts --project=chromium --project=chromium-zoom
node scripts/run-tests.mjs public browser --config=playwright.compat.config.ts --project=firefox
node scripts/run-tests.mjs public browser --config=playwright.compat.config.ts --project=webkit
node scripts/run-tests.mjs public browser --config=playwright.compat.config.ts --project=edge
```

공통 66개는 모든 엔진 대상이며 확장/CDP 확대 1개는 Chromium/Edge 전용이다. Firefox/WebKit에서는 해당 파일을 프로젝트 범위에서 명시적으로 제외하고 실제 200% 확대를 검증했다고 주장하지 않는다. 기존 320~1440px 반응형 검사는 공통으로 유지한다. `edge`는 설치된 Edge를 이용한 선택적 회귀 프로젝트다. 결과 JSON은 `.verification/phase5a-browser-results.json`에 기록하므로 여러 브라우저를 순서대로 실행하면 실행별로 별도 보관해야 한다.

비공개 실전 자료를 가진 기존 로컬 환경에서는 다음을 추가 실행한다.

```sh
npm run verify:local
npm run test:local
npm run test:browser:local
```

이 명령들은 `tests/fixtures/real/manifest.private.json`의 원본/사본 SHA와 실제 보고서를 검사한다. 누락 시 오류로 종료하며 자동 다운로드·재생성·합성 대체·skip을 하지 않는다. 일반 `npm test`는 부모 환경변수와 관계없이 공개 모드를 명시적으로 선택한다. 기본/로컬 모드 모두 동일한 단위·E2E assertion을 실행한다.

## 구조

```text
viewer/
  package.json / package-lock.json
  tsconfig.json / vite.config.ts / vitest.config.ts / playwright.config.ts
  index.html
  scripts/
    generate-validator.mjs    # canonical schema로 standalone validator 생성
    generate-examples.mjs     # 검토한 7개 후보만 해시/계약 확인 후 정적 chunk 생성
    prepare-fixtures.mjs      # 공개 예제 복사·합성 시나리오 생성만 수행
    verify-fixtures.mjs       # 출처·해시·스키마·민감 패턴 검사
    run-tests.mjs             # 공개/비공개 실행 모드 명시; fallback 없음
  src/
    app/App.tsx              # Import UX·키보드·포커스·Drag & Drop
    app/import-state.ts      # 상태 전환과 오류별 복구 안내
    components/              # Overview, Checks, GitChanges, Diagnostics, LogPanel 등
    examples/catalog.ts      # 고정 후보 목록, 지연 로딩·취소·대기 한도
    import/                  # 파서·자원 한도·오류·Worker 통신
    report/                  # type-only bridge, 표시 adapter, 일관성 검사, 분할 문자열 검색
    generated/               # 빌드 생성물; Git 제외
    main.tsx / style.css
  tests/
    fixtures/official/       # 이미 공개된 예제 7개, 공개 원본과 hash 대조
    fixtures/synthetic/      # 합성 계약 데이터 8개
    fixtures/manifest.json   # 공개 테스트 입력만 열거
    fixtures/real/           # Git 제외: 실제 사본 11개와 기존 private manifest
    data-source.ts           # 명시적인 데이터 집합 선택
    parse.spec.ts / worker.spec.ts / import-ui.spec.ts / dashboard.spec.ts / helpers.ts
  e2e/import.spec.ts / import-ux.spec.ts / dashboard.spec.ts
  e2e/design-examples.spec.ts / contrast.spec.ts / zoom.spec.ts
  samples/manifest.json / README.md  # 로컬 체험 후보와 별도 공개 승인 정책
  public/favicon.svg
```

`dist`, `node_modules`, `.verification`, 브라우저 실행 결과와 `tests/fixtures/real/`은 Git 제외 대상이다. 검토한 체험 후보 7개만 allowlist를 통해 별도 정적 JS chunk로 생성하고 필요할 때 불러온다. 나머지 Fixture/비공개 원본은 제품 번들에 넣지 않는다. `public/`에는 정적 favicon만 있다. 현재 dist에도 이 후보 7개가 있으므로 승인 없이 업로드해서는 안 된다.

## JSON 계약과 생성

유일한 런타임 계약 원본은 `../docs/report.schema.json`이다. 빌드·테스트·타입 검사 시작 시 Ajv 2020과 ajv-formats로 standalone ESM validator를 생성한다. 브라우저에서 스키마를 컴파일하거나 사용자 코드/명령을 실행하지 않는다. 기존 `../src/report/types.ts`는 `import type`으로만 참조하며 CLI 런타임은 번들에 포함하지 않는다.

검증은 타입 강제 변환, 기본값 추가, 추가 필드 제거 없이 수행한다. 숫자 schemaVersion 1만 지원한다. 다른 숫자는 `UnsupportedVersion`, 누락·문자열 버전 및 필드 구조 위반은 `SchemaError`다. JSON 구문은 `ParseError`, 잘못된 UTF-8은 `DecodeError`, 파일 읽기 실패는 `ReadError`로 구분한다. UTF-8 BOM 하나는 허용하며 이미 문자열에 있는 `�`는 수정하지 않는다.

통과 결과는 `{ ok: true, report: ReadonlyReport }`, 실패는 `{ ok: false, error: { code, message, issues } }`다. 실패 결과에는 원본/부분 report가 없다. 원본 예외 메시지나 데이터 값을 오류 문구로 반환하지 않는다. 스키마 진단은 제한된 JSON Pointer와 keyword만 포함한다.

`score`, `status`, `exitCode`, summary는 재계산하지 않는다. 구조상 유효하지만 의미가 상충하는 값도 그대로 보존하고, 명확한 교차 필드 불일치만 별도 Viewer 경고로 표시한다. `acceptanceView()`는 원본을 수정하지 않고 Import 상태 표시용 프로젝트명만 길이 제한·제어 문자 이스케이프 처리한다. 반환 타입의 readonly는 정적 TypeScript 경계이며 데이터 서명이나 진실성 인증이 아니다.

## Worker 계약과 한도

요청: `{ protocol: 1, id: 양의 정수, file: Blob }`

응답: `{ protocol: 1, id: 요청 ID, result: ParseResult }`

앱이 생성한 전용 Worker가 파일 읽기 → UTF-8 디코딩 → JSON.parse → 자원 한도 → schema 검증을 수행한다. 성공 시 structured clone으로 report를 반환한다. 메인 스레드는 메시지 envelope를 검사하며, 전체 schema 검증을 다시 실행하지 않는다. 앱 소유 Worker가 신뢰 경계이고 업로드 파일은 신뢰하지 않는다.

한 번에 하나의 요청만 활성화한다. 새 선택·닫기·취소는 이전 Worker를 종료한다. 오래된 응답은 현재 결과를 대체하지 못한다. 생성·전송·실행·역직렬화 오류는 `WorkerError`, 취소는 `Cancelled`다. 결과를 받은 뒤에도 Worker와 타이머를 해제한다.

| Viewer 자원 정책 | 한도 |
| --- | --- |
| 파일 | 10 MiB, 초과 시 읽기 전 거부 |
| 트리 깊이 | 64, 루트 깊이 0 |
| 노드 수 | 200,000, 루트 포함 |
| checks / Git changes | 10,000 / 50,000 |
| Worker 처리 대기 | 5초 |
| 오류 상세 | 최대 20개; path 256자, keyword 64자 |

이는 기존 JSON Schema의 새로운 제약이 아니다. 계약상 유효한 파일이라도 Viewer 자원 한도를 넘으면 `ResourceLimitError`로 거절할 수 있다. 브라우저가 백그라운드 탭의 타이머를 지연시키는 경우 실제 시간은 달라질 수 있다.

## 개인정보와 Fixture

사용자 파일은 메모리에서만 처리한다. 외부 전송, console 출력, localStorage/sessionStorage/IndexedDB/Cache Storage 기록은 구현하지 않는다. 사용자 문자열은 React 텍스트로 렌더링하며 HTML 해석·자동 링크·명령 실행을 하지 않는다. production HTML에는 CSP를 넣으며 앱 자산과 Worker만 자체 origin에서 불러온다. 개발 서버는 HMR 때문에 별도 동작한다.

CSP가 호스팅 서버·브라우저 확장·OS까지 보호하는 sandbox는 아니다. 별도 Worker의 CSP는 서버 응답 정책의 영향도 받는다. Worker 코드 자체에 파일 전송/저장 API 호출이 없고 실제 production 브라우저 테스트에서 전송·저장 부재를 확인했다.

공개 테스트 manifest는 `published-official-example` 7개와 `synthetic-contract-test` 8개를 구분한다. `publicRepositoryEligible: true`는 공개 소스 테스트 입력임을 뜻하며, `publicSampleApproved`는 별도 체험 샘플 승인 여부다. `samples/manifest.json`의 정확히 7개만 사용자 승인 완료로 표시했고 공개 테스트 manifest의 해당 7개도 true로 동기화했다. 나머지 8개는 테스트 전용이며 false를 유지한다. 기존 private manifest는 `real/`에 바이트 그대로 보존했고 실제 11개 사본/원본의 hash를 계속 확인한다.

공개 Fixture와 공개 원본의 SHA-256은 UTF-8 파일의 물리적인 CRLF를 LF로 통일해 계산한다(`sha256-utf8-lf`). Git checkout의 줄바꿈 설정 차이만 허용하며 JSON 문자열 값이나 내용은 변경하지 않는다. 비공개 실전 증거는 기존 바이트 단위 SHA-256 검증을 유지한다.

합성은 설정 오류·취소·선택 실패·로그 잘림 4개와 3/3·100, 2/3·67, 3/4·75, 4/4·100 의미적 시나리오 4개다. 새 시나리오는 계약에서 직접 작성했으며 mini-lang 원본 로그·UUID·시간·SHA를 복사하지 않았다. JSON의 프로젝트명/로그와 manifest에도 SYNTHETIC/실행 기록 아님을 명시한다.

`node scripts/prepare-fixtures.mjs`는 공개 예제를 복사하고 새 합성 시나리오를 생성하여 공개 manifest를 갱신한다. 비공개 파일을 읽거나 수정하지 않는다. 일반 install/build/test에서는 이 생성기를 호출하지 않고 저장된 snapshot을 검증만 하므로 손상된 테스트 입력을 조용히 복구하지 않는다.

`publicSampleApproved: false`와 npm `private: true`는 Public GitHub의 소스 공개를 막지 않는다. Pages 번들에 포함되지 않아도 Git에 커밋한 테스트 로그는 공개된다. `.gitignore`는 실수로 add되는 것을 줄일 뿐 강제 add나 이미 추적된 파일을 보호하지 않는다.

기존 `docs/experiments/`와 `docs/MINI_LANG_FIELD_REPORT.md`는 Viewer 밖의 미커밋 자료이며 이번 공개 후보에서 제외한다. Viewer 내부 ignore가 이 경로를 보호하지는 않으므로 후속 staging 시에도 별도 확인해야 한다. 공개 검증에는 이 문서나 실전 원본이 필요하지 않다. 로컬 실전 명령만 해당 출처에 의존한다.

단계별 Phase 보고서는 로컬 감사 기록으로 보존하며 공개 checkout에는 포함하지 않는다. 스크린리더 직접 검증, 키보드 간헐성 원인, 닫기 후 마지막 객체 참조의 일반 브라우저 수명은 미확정 사항이다. 공개 데이터 승인과 commit/push·원격 CI·Pages 배포 승인은 별개다.
