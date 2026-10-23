# JSON Report Viewer v0.1 요구사항

설계일: 2026-10-20. 상태: **설계 완료 / 구현·배포 미착수**. Viewer의 버전과 CLI 0.1.0 및 `schemaVersion=1`은 서로 다른 개념이다. 본 문서와 [아키텍처](VIEWER_ARCHITECTURE.md), [구현 계획](VIEWER_IMPLEMENTATION_PLAN.md)은 후속 구현의 기준이며, 실행 완료를 주장하지 않는다.

## 1. 근거와 실제 파일 확인

다음 자료를 로컬에서 직접 읽었다. 요청 자료 중 누락·접근 불가한 파일은 없다.

| 자료 | 확인 내용 |
| --- | --- |
| `docs/report.schema.json` | draft 2020-12, schemaVersion은 숫자 1, strict object 계약, nullable/optional 필드 |
| `docs/report-schema.md`, `src/report/types.ts`, `src/report/schema.ts` | 판정·점수·Git·로그 의미, 설정 오류도 같은 envelope 사용 |
| `README.md`, `docs/architecture.md` | 공개 CLI 계약, 순차 검사, before-commands Git snapshot, 로컬 명령 신뢰 전제 |
| `examples/reports/` | 실제 보고서 7개: success-no-git, test-failure, type-error, execution-error, timeout, forbidden-file, requirements |
| `docs/MINI_LANG_FIELD_REPORT.md` | 현재 HEAD 복사본을 사용한 실전 검증과 원본 보존 기록 |
| `docs/experiments/mini-lang-2026-10-20/` | normal, test-failure, forbidden-change, restored 보고서 4개 존재. generated/normal/forbidden YAML, terminal 출력, 직접 실행 결과와 요약도 존재 |

실제 보고서 11개를 읽고 현재 빌드된 reportSchema로 구조 검증하여 모두 통과했다. Viewer 자체 테스트를 실행한 것은 아니다. `direct-command-results.json`, `verification-summary.json`은 보고서 envelope가 아닌 보조 근거이며 Import/공개 샘플 목록에 넣지 않는다. mini-lang 기록은 현재 로컬의 미커밋 자료이므로 GitHub에서 이미 제공된다고 가정하지 않는다.

이번 검토에서 설정 오류·취소·선택 검사 실패의 독립 JSON 예제 파일은 위 두 디렉터리에 없었다. timeout·실행 오류·Git 비활성·불완전 점수 예제는 존재한다. 누락 사례는 구현 계획에서 확보 방법을 정한다.

## 2. 목표·비목표

목표는 로컬 JSON 한 개를 브라우저에서 안전하게 읽고 **보고서가 기록한 결과와 그 한계**를 이해하게 하는 것이다. GitHub Pages에서 정적 호스팅하며 서버 API, 사용자 계정, DB, AI 분석은 없다.

P0(출시 필수): 파일 선택/Drag & Drop, 네 전체 상태, 오류 분리, Overview/Checks/Git, 로그 펼치기·문자열 검색, 공개 샘플, 반응형·다크 모드·키보드 접근, 개인정보 및 용량 보호, schemaVersion=1 호환성.

P1(후속): 다중 보고서 비교, 설정 fingerprint 연계, Vitest/JUnit 구조화 연계, 고급 필터. 이번 Viewer v0.1 완료 조건에 넣지 않는다.

비목표: 보고서 생성/편집/재평가, 명령 실행, 로컬 디렉터리 탐색, 자동 GitHub 코드 링크, 원격 URL Import, 보고서 업로드·공유 링크·내보내기·보관 이력, 로그 기반 AI 판단/테스트 개수 추론, 로그인, 텔레메트리, PWA/service worker, npm CLI 변경. 백엔드와 차트 라이브러리도 도입하지 않는다.

## 3. 사용자 흐름과 화면 구성

단일 페이지, 한 번에 한 보고서만 활성화한다. 최초 화면에는 도구 설명, ‘JSON 파일 열기’, drop 영역, 공개 예제 목록과 ‘파일 내용은 브라우저 안에서 처리됩니다’ 안내를 둔다. 파일명·검색어·보고서 데이터는 URL에 넣지 않는다.

보고서를 연 뒤 상단에 출처(로컬 파일/공개 예제), 파일명 또는 샘플 제목, 바꾸기/닫기, 테마 선택을 둔다. 본문은 **Overview → Checks → Git Changes** 순서다. 화면 내 앵커 이동만 사용하고 URL 경로별 SPA 라우터는 쓰지 않는다. 작은 화면에서는 한 열, 넓은 화면에서는 Overview 요약을 나란히 배치한다. 로그는 기본 접힘, 실패·오류 검사에는 눈에 띄는 상태 텍스트를 제공한다.

다른 파일 선택 시 현재 보고서를 먼저 비우고 검증 중 상태를 표시한다. 실패하면 이전 보고서가 새 파일의 결과인 것처럼 남지 않게 한다. 선택 취소는 현재 상태를 유지한다. 닫기/교체 시 report, 검색 결과, 펼침 상태, 진행 중 Worker를 정리한다. 같은 파일 재선택도 가능해야 한다.

### Overview — P0

| 표시 | 근거와 규칙 |
| --- | --- |
| 프로젝트/도구 | `project.name`, `tool.name`, `tool.version`; 저장소 URL·루트 경로·branch를 추정하지 않음 |
| 실행 식별 | `run.id`, startedAt, endedAt, durationMs. 기본 UTC 표시, 선택한 로컬 시간대명을 함께 표시 가능. 원래 ISO 값을 확인 가능하게 함 |
| 전체 상태/종료 코드 | `status`, `exitCode` 그대로. passed/failed/error/cancelled를 텍스트·아이콘으로 구분 |
| 점수 | score 숫자 또는 null이면 ‘산정되지 않음’. null을 0으로 바꾸지 않음. scoreComplete=false는 별도 ‘불완전 점수’ 표시 |
| 검사 요약 | `summary.pass / summary.total`, fail/error/skipped, required/optional/optionalFailures. 검사 수이지 Vitest testcase 수가 아님 |
| 진단 | `errors[]`, `warnings[]`의 code/message/hint. 배열이 비어 있어도 전체 error를 지우지 않으며 Checks의 error도 함께 확인하도록 안내 |

고정 설명: ‘점수는 설정된 명령 검사와 활성화된 금지 파일 검사 중 통과 비율입니다. 선택 검사도 포함됩니다. 프로젝트 전체 품질·보안을 보증하지 않으며 서로 다른 검사 구성의 점수를 직접 비교할 수 없습니다.’

Viewer는 점수·판정을 재계산해 덮어쓰지 않는다. 합계/상태 상호 불일치가 있으면 별도 ‘Viewer 일관성 경고’를 표시하고 기록된 값을 보존한다. 보고서가 합법적인 JSON이라고 결과의 진실성·출처가 검증되는 것은 아니다.

### Checks — P0

- label/id, kind(command/forbidden), required, status(pass/fail/error/skipped), durationMs, 개별 exitCode, reason을 표시한다.
- command와 args는 실행 가능한 shell 문자열로 합성하지 않는다. executable과 JSON 문자열 배열 형태를 분리 표시하며 실행 버튼은 없다.
- timedOut=true와 signal이 있으면 표시한다. 선택 필드의 누락은 ‘미제공’, 빈 stdout/stderr는 ‘빈 출력’으로 구분한다. null exitCode는 ‘종료 코드 없음’이다.
- 개별 exitCode로 status를 다시 결정하지 않는다. 기존 type-error 예제의 TypeScript exitCode=2, check status=fail, 전체 failed/1은 유효하다.
- stdout/stderr 각각 접기, 평문 검색, 이전/다음 검색 결과 이동. 사용자 정규식과 HTML/Markdown 렌더링은 지원하지 않는다.
- outputTruncated=true는 ‘CLI가 출력을 잘랐음’, Viewer의 페이지 나눔은 ‘표시 구간’으로 따로 표시한다. 원본에 없는 로그를 복원할 수 있다고 안내하지 않는다.
- 위반 목록은 forbidden 검사에 붙은 `violations`의 path/pattern을 그대로 표시한다. forbidden 검사가 없으면 ‘보고서에 보호 검사 결과 없음’이지 통과가 아니다.

### Git Changes — P0

- `git=null`: ‘Git 분석 결과 없음’. 비활성으로 단정하지 않는다.
- `git.enabled=false`: ‘Git 검사 비활성’. 깨끗한 저장소 또는 보호 검사 PASS로 표시하지 않는다.
- 활성일 때 baseRef/baseSha, capturedAt, ‘명령 실행 전 snapshot’을 표시한다. 이 SHA는 평가 기준이며 현재 HEAD/최신 커밋이라고 이름 붙이지 않는다.
- changes의 path, oldPath, 원본 status, additions/deletions, binary를 표시한다. 알려진 상태는 보조 설명을 붙이되 알 수 없는 문자열도 원문을 유지한다. 이름 변경은 oldPath→path로 표시한다.
- null 줄 수는 ‘알 수 없음’. stats.additions/deletions는 알려진 tracked 텍스트 합계다. incomplete=true면 전체 줄 수가 아님을 표시한다.
- scoreComplete와 git.stats.incomplete는 별개다. mini-lang 정상 사례는 둘 다 true이며 모순이 아니다.
- forbidden 위반은 Checks와 같은 기록을 참조한다. Git 변경 목록에서 새로 glob을 실행하거나 위반을 추정하지 않는다. 규칙 전체 목록은 JSON에 없으므로 ‘모든 설정 규칙’ UI는 만들지 않는다.

### Import / Examples — P0

- 사용자 파일 한 개 선택 및 drop. 파일 확장자/MIME은 안내용이며 내용 검증을 대체하지 않는다. 여러 파일/디렉터리/URL drop은 명확히 거절한다.
- UTF-8 읽기 오류, JSON 구문 오류, 지원하지 않는 숫자 schemaVersion, v1 구조 오류, 자원 한도 초과를 구분한다. version 누락/문자열 `"1"`은 스키마 오류이며 숫자 2는 미지원 버전이다.
- errors가 든 유효한 평가 보고서는 Import 실패가 아니다. error/2 화면으로 정상 표시한다.
- 공개 예제는 별도 검토된 allowlist만 제공한다. 기본 mini-lang 4개와 success-no-git/execution-error/timeout을 우선 후보로 한다. 샘플 목록에는 ‘실제 실행의 익명화 사본’ 등 출처를 표시한다.
- `<experiment>`/`<project>` 문자열은 보존하며 HTML 태그로 해석하지 않는다. 보조 요약 JSON을 보고서로 잘못 고르면 스키마 오류를 표시한다.

## 4. 용량·접근성·개인정보 기준

초기 안전 한도는 파일 **10 MiB**, 파싱 후 깊이 **64**, 전체 값 노드 **200,000**, checks **10,000**, Git 변경 **50,000**이다. 이 한도는 Viewer 자원 정책이며 schemaVersion=1의 새로운 제한이 아니다. 유효한 보고서라도 한도를 넘으면 ‘Viewer 처리 한도 초과’로 거절하고 스키마 오류라고 부르지 않는다.

파싱/검증은 전용 Worker에서 수행하고 5초 한도·취소·새 파일 선택 시 Worker 종료를 지원한다. UI에는 읽기 취소 버튼을 둔다. 로그 표시는 한 페이지 최대 32,768 문자, 목록은 100개씩이며 원본 값을 임의로 삭제하지 않는다. 검색어 256 문자, 결과 위치 최대 1,000개 후 ‘추가 일치 가능’ 안내; 검색은 청크별로 UI에 제어를 반환한다. 단일 초장문 줄도 제한에 걸리도록 행 수만으로 제한하지 않는다. 한도는 구현 측정 결과가 아니라 사전 결정값이다.

한국어 UI를 기본으로 하고 상태 식별자는 함께 보여준다. 시스템 테마를 기본값으로 라이트/다크를 수동 선택할 수 있으나 설정도 이번에는 메모리에만 둔다. 폰트는 시스템 폰트, 스타일은 CSS로 제공한다. 320px~1440px, 200% 확대, 키보드만 사용, visible focus, skip link, 명확한 label, aria-live import 상태, 색상 외 상태 구분을 출시 기준으로 한다. 대형 코드 영역만 독립 스크롤하고 본문 전체의 가로 넘침을 막는다. 터치 대상은 최소 44px를 목표로 한다.

파일·로그·검색어·원본 파싱 오류를 네트워크/분석 서비스/console/브라우저 저장소에 기록하지 않는다. 초기 앱 자산 다운로드와 공개 예제 코드 로드는 발생할 수 있으며 ‘웹 페이지가 네트워크를 전혀 사용하지 않는다’고 주장하지 않는다. 브라우저 확장·OS 메모리·악성 호스트 스크립트까지 보호하는 sandbox도 아니다.

## 5. 완료 조건

1. mini-lang 4개 보고서가 3/3·100, 2/3·67, 3/4·75, 4/4·100으로 표시되고 status/exitCode/위반/불완전 통계가 원문과 일치한다.
2. 설정 오류·실행 오류·timeout·취소·Git 비활성·null score·선택 실패·손상 JSON 테스트가 명시한 결과로 통과한다. 누락 fixture를 확보하지 못한 경우 미완료다.
3. XSS, 외부 전송, 저장소 잔존, 대형 입력, import 경쟁 상태, 로그 검색, 접근성 및 모바일 테스트를 통과한다.
4. `/agent-eval-lab/` 아래 빌드 결과의 새로고침·파일 선택·Worker·샘플·CSS/JS가 정상 작동한다. 별도 승인 후에만 실제 Pages smoke test를 수행한다.
5. CLI package.json/lockfile/소스/기존 테스트/보고서 계약은 그대로이고 npm pack에 Viewer 산출물이 포함되지 않는다.
6. README 등 향후 안내에는 검증된 브라우저·한도·개인정보 동작을 기록한다. 미검증 상태를 PASS로 표현하지 않는다.

## 6. 결정 사항과 남은 확정

설계 결정: React + TypeScript + Vite, 독립 viewer 폴더, 단일 페이지, schemaVersion=1만 지원, 로컬 메모리 처리, 정적 샘플, 한국어·시스템 테마, 백엔드 없음. 구체적인 설계는 아키텍처 문서가 기준이다.

구현 착수 전 확인할 사항은 사용자의 **구현 범위 승인**, 사용할 라이브러리의 호환 버전 확정 및 viewer 전용 lockfile 생성 허용이다. 현재 단계에서는 어떤 package.json/lockfile도 만들거나 수정하지 않았다. Pages 공개 승인과 mini-lang 사본의 공개 범위 최종 검토는 배포 단계의 별도 조건이다. 공개 URL은 기존 저장소의 프로젝트 Pages 경로를 기본안으로 정했으며 실제 활성화 여부는 확인·변경하지 않았다.
