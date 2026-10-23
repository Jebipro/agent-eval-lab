import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath, dataModeLabel } from '../tests/data-source';
import { observeImportNetwork } from './network-observer';


for (const name of ['normal', 'test-failure', 'forbidden-change', 'restored']) {
  test(`production Worker validates ${dataModeLabel}: ${name} under project base path`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('./');
    const workerStarted = page.waitForEvent('worker');
    await page.getByLabel('로컬 JSON 파일 선택').setInputFiles(fixturePath(`scenario/${name}.json`));
    const worker = await workerStarted;
    expect(worker.url()).toContain('/agent-eval-lab/assets/');
    await expect(page.getByRole('status')).toContainText('계약 검증 성공');
    expect(errors).toEqual([]);
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toContain("connect-src 'none'");
  });
}

test('invalid import replaces previous report, distinguishes errors, and close clears memory view', async ({ page }) => {
  await page.goto('./');
  const input = page.getByLabel('로컬 JSON 파일 선택');
  await input.setInputFiles(fixturePath('scenario/normal.json'));
  await expect(page.getByRole('status')).toContainText('계약 검증 성공');
  for (const [text, code] of [['{SECRET', 'ParseError'], ['{}', 'SchemaError'], ['{"schemaVersion":2}', 'UnsupportedVersion']]) {
    await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(text!) });
    await expect(page.getByRole('status')).toContainText(code!);
    await expect(page.getByRole('status')).not.toContainText('계약 검증 성공');
    await expect(page.locator('body')).not.toContainText('SECRET');
  }
  await input.setInputFiles(fixturePath('scenario/normal.json'));
  await expect(page.getByRole('status')).toContainText('계약 검증 성공');
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('status')).toBeEmpty();
});

test('input remains literal text with no network transfer, console leak, or browser storage', async ({ page, browserName }) => {
  const sentinel = 'PRIVATE_SENTINEL_719';
  const messages: string[] = [];
  const requests: { url: string; body: string | null; kind: string }[] = [];
  const sockets: string[] = [];
  const verifyNetwork = observeImportNetwork(page);
  page.on('console', message => messages.push(message.text()));
  page.on('pageerror', error => messages.push(error.message));
  page.on('request', request => requests.push({ url: request.url(), body: request.postData(), kind: request.resourceType() }));
  page.on('websocket', socket => sockets.push(socket.url()));
  await page.goto('./');
  const report = JSON.parse(readFileSync(fixturePath('scenario/normal.json'), 'utf8'));
  report.project.name = `<img src=x onerror=alert(1)>${sentinel}`;
  report.checks[0].stdout = `<script>alert('${sentinel}')</script>`;
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles({
    name: `${sentinel}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(report))
  });
  await expect(page.getByRole('status')).toContainText(report.project.name);
  await expect(page.locator('img')).toHaveCount(0);
  await verifyNetwork(browserName, Buffer.from(JSON.stringify(report)), sentinel);
  expect(JSON.stringify(requests)).not.toContain(sentinel);
  expect.soft(messages).toEqual([]);
  expect(sockets).toEqual([]);
  expect(await page.evaluate(async () => ({
    local: localStorage.length, session: sessionStorage.length,
    databases: await indexedDB.databases(), caches: await caches.keys()
  }))).toEqual({ local: 0, session: 0, databases: [], caches: [] });
  await page.reload();
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.locator('body')).not.toContainText(sentinel);
});
