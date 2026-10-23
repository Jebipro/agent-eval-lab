# 체험 예제 7개 — 원문 공개 승인 완료

2026-10-24 KST, 사용자가 아래 7개 전체 JSON 원문 공개를 승인했다. 목록·해시·출처·내용은 그대로 유지했다. 소스 테스트 데이터 15개 전체의 체험 제공 승인이 아니며, commit/push·원격 CI·Pages 배포는 별도 승인 대상이다.

| ID | 후보 파일 (`tests/fixtures/` 기준) | 출처 | 상태·점수·검사 |
| --- | --- | --- | --- |
| success | official/success-no-git.json | 이미 공개된 공식 실행 예제 | passed · 100 · 2/2 |
| failure | official/test-failure.json | 이미 공개된 공식 실행 예제 | failed · 50 · 1/2 |
| forbidden | official/forbidden-file.json | 이미 공개된 공식 실행 예제 | failed · 67 · 2/3 |
| timeout | official/timeout.json | 이미 공개된 공식 실행 예제 | error · 0 · 0/1, 불완전 점수 |
| setup | synthetic/setup-error.json | 합성 계약 데이터, 실제 실행 아님 | error · null · 0/0 |
| cancelled | synthetic/cancelled.json | 합성 계약 데이터, 실제 실행 아님 | cancelled · 0 · 0/2 |
| optional | synthetic/optional-failure.json | 합성 계약 데이터, 실제 실행 아님 | passed · 50 · 1/2 |

정확한 출처 파일, SHA-256(UTF-8 LF 정규화), 검토일, 검토 범위와 한계는 [manifest](manifest.json)에 기록한다. 기존 예제의 점수·상태·로그는 수정하지 않았다. `<project>` 익명 경로가 있는 기존 공식 사본과 기존 합성 데이터를 사용한다. 전체 JSON·명령·인자·stdout/stderr·진단을 읽고 개인 홈 경로, 토큰/키 형태와 비밀 값 노출을 확인했다. `forbidden`의 `.env.example`은 위반 파일명이며 비밀 값이 아니다. 패턴 검사만으로 모든 비밀 부재를 증명할 수는 없다.

mini-lang 실제 기록과 비공개 `real/` 자료는 포함하지 않는다. 3/3·100, 2/3·67, 3/4·75, 4/4·100 합성 시나리오는 공개 회귀 테스트에는 유지하지만 이번 체험 후보에는 넣지 않았다.

빌드는 정확히 7개 allowlist 파일의 해시·출처·schema·기대 요약을 검사하고 `src/generated/example-data.ts`를 생성한다. 파일 glob, 외부 URL, 사용자 지정 URL은 사용하지 않는다. 이 모듈은 별도 same-origin JS chunk로 지연 로딩한다. `connect-src 'none'`을 유지하며 사용자 JSON을 요청 URL이나 본문에 넣지 않는다. 불러온 예제 문자열도 File → 기존 Worker → canonical schema 검증을 거친다.

취소는 앱의 대기를 끝내고 오래된 결과 적용을 막는다. 브라우저의 이미 시작된 정적 module 다운로드 자체는 중단하지 못하며 해당 공개 후보 chunk가 HTTP 캐시에 남을 수 있다. 사용자 로컬 보고서나 테마를 저장하는 동작은 없다. 예제 chunk 실패가 브라우저에 캐시되면 페이지 새로고침 또는 로컬 파일 열기로 복구한다.

승인 필드는 정책·검토 기록이며 강제 배포 차단 장치는 아니다. production build에는 승인된 7개 내용이 들어 있다. 실제 소스 업로드·CI 실행·dist 배포는 별도 승인과 최종 파일 목록 검토가 필요하다. 배포 자동화는 이번 단계에 추가하지 않았다.
