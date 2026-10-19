# Local release procedure

Status: **unpublished**. No GitHub repository creation, remote push, or npm publish was performed. The owner selected `Jebipro/agent-eval-lab` (Public, default branch `main`); metadata now uses that intended URL. Creation and first push require separate approval. See [current readiness and CI status](GITHUB_RELEASE_READINESS.md). `npm view agent-eval-lab name version --json` returned E404 on 2026-10-18 Asia/Seoul; this is not a reservation, ownership check, or guarantee that publication will succeed.

1. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm pack --dry-run`, `npm run test:package`.
2. Inspect `docs/package-verification.json`, `docs/REMEDIATION_REPORT.md`, `docs/GITHUB_RELEASE_READINESS.md`, and the tarball file list. The initial `docs/verification.md` is historical. Build output, report JSON Schema, README, LICENSE, and package metadata belong in the package. Fixtures, tests, reports and source do not.
3. Run the defined Linux/Windows, Node 22/24 CI matrix in the authorized repository. Resolve actual failures. Do not infer a CI pass from YAML alone.
4. Obtain explicit owner authorization and actual GitHub/npm targets. Confirm package-name rights with the publishing account. If unavailable, discuss the target/name before changing the product or bin.
5. Fill real repository/homepage/bugs URLs once assigned; recheck license attribution with the owner. MIT is the new project's default; no individual owner name was invented.
6. Only after authorization, create/push the intended repository and publish the inspected package. Verify installed registry CLI behavior and pin the verified version in consumer CI examples.
7. Update README publication state with actual evidence. A local tarball test is not a registry publication test.

`prepack` builds for the publisher. There are no install/postinstall/prepare hooks that force a consumer build. The bin is `dist/cli/index.js` with a shebang; the build requests mode 0755. Windows tar archives record mode 0644, and npm's bin-links installation creates the Windows shim or applies executable permissions on POSIX. The installed Windows bin was tested; the Linux matrix must verify its installed bin before Linux support is confirmed. Raw tar extraction is not the documented installation path. Exact runtime dependencies and the lockfile support reproducible development; the package's files allowlist limits release content. Source maps are not shipped.

`test:package` keeps the exact generated tarball in the source folder (Git-ignored) and deletes only its own verified temporary consumer folder. It installs without development dependencies, verifies no TypeScript/source runner dependency for the tool, uses independent target fixture dependencies, and measures prepared init → run → read JSON. Install timing includes available cache and is recorded separately. Cold registry download timing remains unmeasured.
