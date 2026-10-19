# npm v0.1.0 release report

게시·소비자 검증일: 2026-10-19. GitHub 문서 정리일: 2026-10-20 (Asia/Seoul).

**상태: PUBLISHED / REGISTRY CONSUMER VERIFIED (Windows Node 24).** 사용자 터미널의 게시 완료 통지 후 공식 registry에서 **jebipro / agent-eval-lab@0.1.0 / latest=0.1.0**을 독립 확인했다. 인증 없는 registry 조회와 새 소비자 설치가 성공했다. 공개 tarball의 SHA-256은 승인값과 일치한다. 실제 `npx init/run`, 종료 코드 0/1/2, JSON 보고서 검증 모두 PASS다. 최초 비대화형 게시의 EOTP 실패 이력은 6절에 보존했다. npm 웹 페이지 본문은 HTTP 403으로 확인하지 못했다. 이후 별도 사용자 승인에 따라 README와 본 보고서를 GitHub 공개용으로 정리했다. npm 재게시, GitHub Release 및 Pages는 이번 문서 작업에 포함하지 않는다.

## 1. 소스 및 기존 검증 확인

- GitHub: https://github.com/Jebipro/agent-eval-lab, 기본 브랜치 `main`.
- npm 게시 준비 당시 로컬 HEAD와 원격 main: `16b14dded28b618535fa07551d542ec2a7185332`로 일치.
- 최초 준비 시 tracked 변경 없음. 이후 사용자 요청에 따라 README의 미게시/임시 안내만 정리하고 로컬 tarball 설명을 개발 섹션으로 이동했다. 제품 코드·기존 테스트·package metadata·lockfile은 수정하지 않았다. 게시된 산출물은 위 소스 커밋과 게시 당시 README 수정으로 구성된다. 게시 후 GitHub 문서 정리에서는 npm 패키지 및 본 보고서 링크를 README에 추가했다.
- [게시 전 소스 커밋의 실제 CI](https://github.com/Jebipro/agent-eval-lab/actions/runs/39216945445)를 다시 조회해 네 job의 success 및 대상 SHA를 확인했다. 아래 기존 테스트 수치는 이 실행의 기록이다. 문서 정리 커밋의 네 환경 CI는 [main의 CI 실행 목록](https://github.com/Jebipro/agent-eval-lab/actions/workflows/ci.yml?query=branch%3Amain)에서 해당 커밋 SHA와 연결된 실행을 기준으로 확인한다.
- 기존 Adversarial Review, Remediation, GitHub 공개 기록과 검증 JSON은 보존했다. 새 소비자 검증이 일시적으로 생성하는 package-verification.json도 실행 후 원본으로 복원했다.
- 감사 원본 SHA-256: `5D860C29616E5DCD4D96177DAC45F69C97B62320AB3800D17E1C6CD63B25D03A`.

## 2. npm 계정·이름·권한

| 항목 | 실제 결과 |
| --- | --- |
| 로컬 Node / npm CLI | v24.16.0 / 11.13.0 |
| 설정된 registry | `https://registry.npmjs.org/` |
| `npm whoami --registry=https://registry.npmjs.org/` | 최초 ENEEDAUTH → 사용자 로그인 후 **jebipro**, 종료 0 |
| 실제 npm 사용자 | **jebipro**, GitHub 계정과 별도로 실제 조회하여 확인 |
| 준비 당시 이름 조회 | **E404**, 당시 조회 가능한 등록 없음 |
| 게시 후 공식 registry | **HTTP 200**, name=agent-eval-lab, version=0.1.0, latest=0.1.0, 게시자/maintainer=jebipro |
| 이메일 인증 | **완료**, email_verified=true. 주소 자체는 보고서에 저장하지 않음 |
| 2FA 상태 | 최초 비활성 → 사용자 설정 후 **활성**, mode=auth-and-writes, pending=false (2026-10-19 재확인) |
| 첫 게시 권한 / 승인 | 명시적 사용자 승인 후 최초 비TTY 명령은 EOTP. 사용자 터미널 완료 통지 후 실제 게시 및 공개 다운로드 확인 |

네트워크 제한 밖에서 공식 registry에 조회한 결과다. 로그인/2FA 확인 당시에는 E404였고, 사용자 터미널 게시 이후 0.1.0의 실제 등록을 확인했다. 공개 결과는 dry-run이나 사용자 통지만으로 판정하지 않았다. 이름과 버전을 변경하지 않았다.

사용자는 본인 터미널에서 다음 공식 웹 로그인을 완료했다고 알렸고, 실제 whoami 성공을 확인했다. 비밀번호·인증 토큰·OTP는 대화에 보내거나 프로젝트 파일에 저장하지 않고 공식 인증 UI에서만 입력한다. 에이전트가 별도의 장기 토큰을 생성하거나 .npmrc의 인증 값을 읽지는 않았다.

```sh
npm login --auth-type=web --registry=https://registry.npmjs.org/
```

후속 프로필 확인은 필요한 상태 필드만 추출하여 표시했다. npm 11.13의 `profile get tfa --json`은 필드 지정에도 전체 프로필을 반환했으므로 같은 출력 방식을 반복하지 않았다. npm은 직접 게시에 계정 2FA 또는 bypass-2FA granular token 조건을 안내한다. 이번에는 불필요한 장기 토큰 대신 사용자 2FA를 사용한다. 사용자 설정 후 활성 상태를 실제로 재확인했으며, tarball 해시도 그대로다. 게시 시 추가 인증 요청은 사용자가 공식 UI에서 완료해야 한다. [공식 2FA 설정](https://docs.npmjs.com/configuring-two-factor-authentication/), [공식 로그인](https://docs.npmjs.com/cli/v11/commands/npm-login/), [2FA 안내](https://docs.npmjs.com/about-two-factor-authentication/), [2FA 사용](https://docs.npmjs.com/accessing-npm-using-2fa/).

## 3. 승인·게시된 정확한 산출물

| 필드 | 값 |
| --- | --- |
| name / version | **agent-eval-lab / 0.1.0** |
| license | MIT |
| repository | `git+https://github.com/Jebipro/agent-eval-lab.git` |
| engines | Node `>=22.12.0` |
| bin | `agent-eval-lab` → `dist/cli/index.js`, Node shebang 확인 |
| npm files allowlist | `dist`, `docs/report.schema.json`, `README.md`, `LICENSE` |
| tarball | `agent-eval-lab-0.1.0.tgz` (Git-ignored) |
| 실제 파일 수 / 압축 크기 | **36개 / 25,645 bytes** |
| unpacked size | **86,325 bytes** |
| SHA-256 | `27ec556e4c28d72cf7ebfe5ef681adb73c2f09261a7181c1fdf3988e81689dce` |
| npm shasum (SHA-1) | `4819276199faef20b47dbc7a1d9e7fb3ffb1fd58` |
| npm integrity | `sha512-lUGsbwD6ytIfSr6Eb1YF825b5MgeT89J1C9fMe72GDaalx0YG1Q3HHeJk8ckdIpIBHs2Qf+Butg8x9YqJQtN+w==` |

이 후보가 미게시 안내를 포함하던 이전 후보를 대체한다. 이전 SHA-256 `59ad7802c602c1b0ed04fe006efc4d739804069fbd06f863d151b7bdd52e2c95` (25,923 bytes)는 승인/게시 대상에서 제외한다. 이름과 버전은 변경하지 않았다.

실제 tar archive를 열어 36개 경로/바이트를 현재 파일과 비교하고 dry-run의 파일 목록·SHA-1·SHA-512와 대조했다. 압축된 산출물 자체를 스캔하여 개인 홈 경로, 인증 토큰, private key 패턴이 없음을 확인했다. 검사 범위 내 결과이며 모든 형태의 비밀정보 부재를 보증하는 것은 아니다.

컴파일된 JavaScript 16개와 타입 선언 16개, package.json/README/LICENSE/JSON Schema가 포함된다. 구현용 .ts/.tsx, tests, fixtures, node_modules, 소스맵, .git/.ci-results, 개인 .env/.npmrc, 임시 로그 및 감사 보고서는 포함되지 않는다. .d.ts는 컴파일 산출물이며 실행 시 TypeScript compiler를 요구하지 않는다.

Runtime dependencies는 cross-spawn 7.0.6, jsonc-parser 3.3.1, minimatch 10.2.4, yaml 2.8.3, zod 4.3.6이다. 정상 prepack은 `npm run build`를 실행한다. 소비자 install/postinstall/prepare build hook은 없으며 생산 의존성만 설치한 환경에서 실행을 확인했다. 평가 대상 프로젝트의 자체 test/typecheck 도구는 별도 준비가 필요하다.

## 4. 검증 결과

| 검사 | 결과 |
| --- | --- |
| Windows Node 22.23.3 / 24.21.0 실제 최종 CI | 각각 **89 passed / 2 skipped / 0 failed** |
| Ubuntu Node 22.23.3 / 24.21.0 실제 최종 CI | 각각 **81 passed / 10 skipped / 0 failed** |
| 네 CI job의 typecheck/build/pack/외부 소비자 | 모두 PASS, 위 소스 SHA의 게시 전 실행 근거. 문서 정리 이후 실행과 구분 |
| 로컬 strict typecheck | 앞선 준비에서 **PASS**, 종료 0. 이후 README만 수정하여 불필요하게 반복하지 않음 |
| 이번 정상 build 및 npm pack | **PASS**, `npm run test:package` 내부 정상 prepack/build/pack 실행 |
| 이번 새 tarball의 외부 소비자 | **PASS**, `--omit=dev`, installed bin help/version/init/run, 소스 build/dev runner 불필요 |
| 실제 실패/오류 및 JSON | **PASS**, assertion 실패 1, 실행/설정 오류 2, report schema 및 JSON stdout/저장 파일 일치 |
| 새 tarball publish dry-run | **PASS**, 종료 0. 실제 게시/권한 확정은 아님 |
| README 일관성 | 게시 당시 tarball과 로컬 README 바이트 동일. 게시 후 GitHub용 README에 npm 공개 상태·패키지 URL·본 보고서 링크 추가. Quick Start 및 CLI 계약 동일; 이미 게시된 README와 바이트 동일하다고 주장하지 않음 |
| 공개 registry 설치 / 실제 npx | **PASS**, Windows Node 24.16.0, 새 소스 외부 소비자 및 빈 캐시, registry 이름 설치 |
| 공개 tarball 무결성 | **PASS**, SHA-256 승인값 일치, SHA-1/SHA-512 registry metadata 일치 |
| npm 웹 페이지 본문 | **미검증**, 자동 HTTP 조회 403. registry 등록/다운로드/설치 성공과 구분 |

README 수정 후 새 tarball의 로컬 소비자 검증 완료: 2026-10-19 22:33:11 KST. 소비자 설치 3,560ms, fixture 의존성 설치 2,796ms, 준비된 init/run/읽기 3,323ms. offline warm cache를 사용했으므로 cold-cache 공개 registry 최초 설치 시간은 아니다. OS별 제외는 원래 Windows/POSIX 전용 조건이며 테스트를 약화하지 않았다. 기존 TTY/Ctrl+C 기록은 보존하며 이번에 반복하지 않았다.

준비 단계에서 실행한 dry-run 명령은 다음과 같다. 이후 별도 승인에 따라 수행한 실제 게시 시도는 6절에 구분해 기록했다.

```sh
npm publish ./agent-eval-lab-0.1.0.tgz --dry-run --json --access public --tag latest --registry=https://registry.npmjs.org/ --fetch-retries=0
```

새 증거는 Git-ignored `.ci-results/npm-readme-revision/`의 package.log, package-verification.json, publish-dry-run.json, artifact-review.json에 보관했다. 이전 준비 증거와 typecheck.log는 `.ci-results/npm-preparation/`에 보존했다. 핵심 수치와 해시는 본문에도 기록했다.

## 5. 게시 방식 비교 및 권고

| 방식 | 보안 / 초기 설정 | 유지보수 및 이번 선택 |
| --- | --- | --- |
| 수동 publish + 사용자 2FA | 공식 로그인과 게시 시 인증 필요. CI용 장기 토큰/Secrets 불필요 | 첫 버전의 검토된 tarball 하나를 명시적으로 승인·게시하기에 단순함. **이번 v0.1 권장** |
| GitHub Actions Trusted Publishing(OIDC) | 단기 workflow identity 사용. npm 신뢰 연결, 저장소/workflow/허용 동작 설정 및 id-token 권한 필요 | 반복 배포에 유리하고 public GitHub의 provenance 자동 생성 지원. 별도 승인 후 도입 권장 |

공식 OIDC 요구 버전은 npm 11.5.1+ 및 Node 22.14+로 로컬 버전은 충족한다. 그러나 이 패키지의 신뢰 연결과 게시 workflow는 설정하지 않았다. 기존 CI는 검증 전용이며 게시 권한을 추가하지 않았다. 새 설정의 유효기간/허용 동작 조건도 실제 도입 시 재확인한다. [공식 Trusted Publishing 문서](https://docs.npmjs.com/trusted-publishers/).

OIDC의 장점은 후속 자동 배포에서 활용하되, 이번에는 사용자 계정/2FA를 먼저 확인하고 수동 첫 게시를 검토하는 것이 작업 범위에 적합하다는 판단이다. 어떤 방식도 사용자 승인 전 실제 게시, stage publish 또는 dist-tag 변경을 하지 않는다. 권장 수동 명령에는 provenance 생성 요청이 없으며 GitHub CI 성공 자체를 npm provenance로 표현하지 않는다.

## 6. 승인된 게시 이력 및 공개 확인

사용자는 `jebipro` 계정, `agent-eval-lab@0.1.0`, Public/latest 및 SHA-256 `27ec556e4c28d72cf7ebfe5ef681adb73c2f09261a7181c1fdf3988e81689dce`의 tarball 게시를 명시적으로 승인했다. 직전 해시가 일치함을 확인하고 아래 게시 명령을 1회 실행했다. 원시 인증 응답/OTP를 출력·저장하지 않도록 결과에서 종료 코드와 오류 코드만 추출했고, npm debug log 저장을 비활성화했다.

```sh
npm publish ./agent-eval-lab-0.1.0.tgz --access=public --tag=latest --registry=https://registry.npmjs.org/ --fetch-retries=0 --logs-max=0 --loglevel=error --json
```

| 시각 (KST) | 실제 결과 |
| --- | --- |
| 2026-10-19 22:42:15 | publish 종료 1, **EOTP**, 성공 아님 |
| 2026-10-19 22:42:44 | 공식 registry 재조회 **E404**, 패키지 등록 확인되지 않음 |
| 2026-10-19 22:47:18 | registry의 0.1.0 게시 시각: `2026-10-19T13:47:18.056Z` |
| 2026-10-19 22:48–22:49 | 공식 registry HTTP 200, 게시자 jebipro, latest=0.1.0, 공개 tarball 무결성 확인 |

npm 11.13의 로컬 공식 CLI 구현은 비TTY 환경에서 EOTP가 발생하면 인터랙티브 웹/OTP 인증을 진행하지 않고 오류를 반환한다. 최초 프로세스는 인증 값 노출을 막기 위해 출력을 캡처하는 비TTY 실행이었으므로 추가 인증을 완료하지 못했다. 2FA 미설정이나 tarball 검증 실패로 판단하지 않는다. 자동 재게시, 새 버전 게시, 별도 dist-tag 변경은 하지 않았으며 원인과 registry 상태를 사용자에게 먼저 알렸다. 이후 사용자가 본인 터미널에서 게시 완료를 통지했고, registry와 소비자 검증으로 결과를 독립 확인했다. 사용자 터미널의 인증 값이나 출력 원문을 수집하지 않았다.

사용자는 프로젝트 폴더의 본인 터미널에서 같은 tarball에 대한 아래 명령과 npm의 공식 추가 인증을 완료하도록 안내받았다. 인증 코드·토큰은 대화로 요청하지 않는다. 기존 게시 승인은 유효하며 새로운 게시 승인을 요구하는 것이 아니다.

```sh
npm publish ./agent-eval-lab-0.1.0.tgz --access public --tag latest --registry=https://registry.npmjs.org/ --logs-max=0
```

게시 범위는 계속 `agent-eval-lab@0.1.0`, Public/latest다. 이름/버전 조합은 게시 후 재사용할 수 없으므로 오류가 발생해도 임의 버전 증가나 재게시를 반복하지 않고 registry 상태부터 확인한다. [공식 publish 동작](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

시도/직후 조회의 비민감 결과는 `.ci-results/npm-readme-revision/publish-attempt.json`, `registry-after-attempt.json`에 보존했다. 게시 후 결과는 `registry-publication.json`, `registry-consumer-verification.json`에 저장했다. 공개 tarball은 승인된 파일과 SHA-256/SHA-1/SHA-512가 일치하므로 바이트가 같은 산출물임을 확인했다.

첫 소비자 검증 시도는 metadata에 0.1.0이 없어 설치 전 중단됐다. 이후 읽기 전용 재조회에서 0.1.0 등록을 확인한 다음 검증을 실행했다. registry에는 `0.0.0-stage`도 조회되며 설명은 `Temporary package placeholder for staged publishing`, 생성 시각은 22:46:42 KST다. 에이전트가 실행한 게시 명령은 위의 승인된 tarball 명령뿐이며 별도 stage 명령을 실행하지 않았다. 사용자 터미널 내부 동작은 관찰하지 않았으므로 생성 경위를 확정하지 않는다. **latest는 0.1.0**이며, placeholder 삭제/버전 변경/dist-tag 변경은 수행하지 않았다.

## 7. 게시 후 실제 소비자 검증 결과

검증 환경: Windows, Node v24.16.0 / npm 11.13.0. 소스 밖의 새 임시 디렉터리와 처음 생성한 npm cache를 사용했다. `npm install --omit=dev --no-audit --no-fund agent-eval-lab@0.1.0`을 공식 registry 지정으로 실행했다. offline/prefer-offline은 false, prefer-online은 true였다. 로컬 tarball을 설치에 사용하지 않았고, 설치 lockfile의 resolved URL 및 integrity가 공개 registry 값과 일치했다. 소비자에 TypeScript compiler 및 패키지 src가 없음을 확인했다. 검증 후 해당 임시 디렉터리는 정리했다.

| 실제 실행 / 확인 | 결과 |
| --- | --- |
| 인증 없는 공식 registry 조회·tarball 다운로드 | HTTP 200, Public 접근 확인 |
| 공개 tarball SHA-256/SHA-1/SHA-512 | 모두 일치, 3절의 승인된 36개 파일 산출물 |
| 새 소비자의 이름 기반 registry 설치 | PASS, 개발 저장소/기존 tarball/cache와 분리 |
| `npx --yes agent-eval-lab --version`, `--help` | 종료 0, 버전 0.1.0 |
| `npx --yes agent-eval-lab init <project> --yes` | 종료 0, 한글·공백 경로의 fixture 초기화 |
| `npx --yes agent-eval-lab run <project> --non-interactive` | 종료 0, terminal PASSED |
| `npx --yes agent-eval-lab run <project> --json` | 종료 0, status=passed, 단일 JSON stdout, 설치본 reportSchema 통과, `.agent-eval/report.json`과 동일 |
| fixture 덧셈을 뺄셈으로 변경한 실제 테스트 실패 | 종료 1, status=failed, JSON schema 통과 |
| 존재하지 않는 command 실행 | 종료 2, status=error, JSON schema 통과 |
| 설정 version=99 | 종료 2, score=null, JSON schema 통과 |

위 npx는 새 소비자의 registry 설치본을 해석해 실행했다. 평가 대상 fixture의 자체 개발 도구는 별도로 npm ci로 준비했다. 공개 CLI가 소스 빌드 없이 동작함을 확인했으며, fixture 자체 도구 불필요를 주장하지 않는다. 검증 스크립트 종료 0 및 8개 검사 묶음 PASS를 기록했다.

패키지 URL: https://www.npmjs.com/package/agent-eval-lab/v/0.1.0. 웹 도구 조회는 Cache miss, 직접 HTTP 조회는 403으로 본문/README 렌더링은 미검증이다. 공개 registry 등록·무결성·설치는 별도로 성공했다. 게시 후 실제 registry 소비자 검증은 Windows Node 24에서만 실행했다. Ubuntu/Node 22의 공개 registry 재설치 및 새 게시본의 TTY/Ctrl+C는 이번에 반복하지 않았으며, 기존 동일 제품 코드의 4개 CI/TTY 기록과 구분한다.

게시된 tarball에는 사용자 요청대로 미게시 안내를 제거한 Quick Start 중심 README가 포함되어 있다. GitHub 문서 정리에서는 npm 공개 완료 문구, 패키지 URL, 본 보고서 링크를 추가했다. 두 README의 설치·실행 안내는 동일하지만 게시 후 추가된 문구 때문에 파일 전체는 바이트 동일하지 않다. 게시 후 GitHub README 변경은 이미 게시된 tarball에 소급 적용되지 않는다. 이를 위해 0.1.0을 재게시하거나 버전을 변경하지 않는다.

## 8. 현재 최종 판정

**실제 npm Public 게시: 완료. 실제 registry 소비자 설치·npx 검증: PASS (Windows Node 24).** `agent-eval-lab@0.1.0`, 게시자 jebipro, latest=0.1.0 및 승인된 tarball의 무결성을 확인했다. 사용자 설치 방법은 평가 대상 프로젝트에서 `npx agent-eval-lab init`, `npx agent-eval-lab run`이다. Node 22.12+ 및 평가 대상의 자체 의존성이 필요하다.

남은 검증 항목은 npm 웹 페이지 본문 수동 확인, 필요 시 Ubuntu/Node 22 공개 registry 설치 추가 검증이다. 반복 배포 자동화가 필요해지면 Trusted Publishing과 provenance 도입을 별도로 검토할 수 있다. `0.0.0-stage` placeholder가 조회되는 사실도 위에 기록했으며 임의로 정리하지 않았다. 공개 0.1.0의 설치·실행을 막는 결함은 이번 검증에서 발견하지 않았다.

GitHub 문서 반영에 대한 별도 사용자 승인을 확보했다. 변경 범위는 README와 본 보고서 두 파일이며, 커밋에는 GitHub noreply 이메일을 사용한다. 제품 코드·테스트·패키지 이름/버전·기존 감사·수정·CI 기록과 v0.1 기능/CLI 계약은 보존했다. 기존 감사 보고서 SHA-256도 재확인하여 1절의 값과 같았다. 과거 기록에 있는 당시의 미게시 사실은 변경하지 않았다.

공개 직전 README와 docs의 문서 13개 및 두 staged 문서를 점검했다. 검사한 개인 이메일·개인 홈 경로·npm/GitHub 토큰·비밀 키 패턴에서 발견 사항은 없었다. 명령 예시에 인증 값은 포함하지 않았고, 로컬 증거 로그·tarball은 커밋 대상에서 제외했다. 이 검사는 알려진 패턴과 내용 검토에 한정하며 모든 형태의 비밀정보 부재를 보증하지 않는다.

## 부록: tarball 실제 파일 목록

```text
LICENSE
README.md
dist/cli/args.d.ts
dist/cli/args.js
dist/cli/index.d.ts
dist/cli/index.js
dist/cli/init.d.ts
dist/cli/init.js
dist/config/load.d.ts
dist/config/load.js
dist/config/schema.d.ts
dist/config/schema.js
dist/core/evaluate.d.ts
dist/core/evaluate.js
dist/detect/index.d.ts
dist/detect/index.js
dist/git/snapshot.d.ts
dist/git/snapshot.js
dist/process/cleanup.d.ts
dist/process/cleanup.js
dist/process/invocation.d.ts
dist/process/invocation.js
dist/process/run.d.ts
dist/process/run.js
dist/report/save.d.ts
dist/report/save.js
dist/report/schema.d.ts
dist/report/schema.js
dist/report/serialize.d.ts
dist/report/serialize.js
dist/report/terminal.d.ts
dist/report/terminal.js
dist/report/types.d.ts
dist/report/types.js
docs/report.schema.json
package.json
```
