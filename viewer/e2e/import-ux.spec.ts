import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath } from '../tests/data-source';

const normal = readFileSync(fixturePath('scenario/normal.json'), 'utf8');
const file = (name: string, body = normal) => ({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
const input = (page: Page) => page.getByLabel('로컬 JSON 파일 선택');
const state = (page: Page) => page.getByRole('status');
async function drop(page: Page, names: string[], body = normal, target = '#import-panel') {
  const dataTransfer = await page.evaluateHandle(({ names, body }) => {
    const transfer = new DataTransfer();
    for (const name of names) transfer.items.add(new File([body], name, { type: 'application/json' }));
    return transfer;
  }, { names, body });
  try { await page.locator(target).dispatchEvent('drop', { dataTransfer }); }
  finally { await dataTransfer.dispose(); }
}
async function stallFirstWorker(page: Page) {
  let first = true;
  await page.route('**/assets/import.worker-*.js', async route => {
    if (first) { first = false; await route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => {};' }); }
    else await route.continue();
  });
}
test('Drop, multiple-file rejection, replacement and repeated same-file selection', async ({ page }) => {
  await page.goto('./');
  await drop(page, ['normal.json']);
  await expect(state(page)).toContainText('계약 검증 성공');
  await drop(page, ['first.json', 'second.json']);
  await expect(state(page)).toContainText('MultipleFiles');
  await expect(state(page)).not.toContainText('normal.json');
  await expect(state(page)).not.toContainText('계약 검증 성공');
  for (let i = 0; i < 2; i++) {
    await input(page).setInputFiles(file('same.json'));
    await expect(state(page)).toContainText('계약 검증 성공');
  }
  await input(page).setInputFiles([]);
  await expect(state(page)).toContainText('same.json'); // cancelled picker keeps current report
  const dialog = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '다른 파일로 교체하기' }).click();
  await (await dialog).setFiles(file('replacement.json'));
  await expect(state(page)).toContainText('replacement.json');
  await expect(state(page)).not.toContainText('same.json');
});
test('URL, folder and off-target Drop are rejected without navigating or retaining report', async ({ page }) => {
  await page.goto('./');
  for (const kind of ['url', 'directory', 'outside']) {
    await input(page).setInputFiles(file('old.json'));
    await expect(state(page)).toContainText('계약 검증 성공');
    if (kind === 'outside') await drop(page, ['new.json'], normal, 'h1');
    else await page.locator('#import-panel').evaluate((element, kind) => {
      const transfer = new DataTransfer();
      const descriptor = Object.getOwnPropertyDescriptor(DataTransferItem.prototype, 'webkitGetAsEntry');
      if (kind === 'url') transfer.setData('text/uri-list', 'https://example.invalid/DO_NOT_FETCH');
      else {
        transfer.items.add(new File([''], 'folder'));
        Object.defineProperty(DataTransferItem.prototype, 'webkitGetAsEntry', { configurable: true, value: () => ({ isDirectory: true }) });
      }
      try { element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })); }
      finally { if (descriptor) Object.defineProperty(DataTransferItem.prototype, 'webkitGetAsEntry', descriptor); }
    }, kind);
    await expect(state(page)).toContainText('UnsupportedDrop');
    await expect(state(page)).not.toContainText('old.json');
    expect(page.url()).toBe('http://127.0.0.1:4173/agent-eval-lab/');
  }
});
test('rapid replacement cancels a stalled worker and only the last file is accepted', async ({ page }) => {
  await stallFirstWorker(page); await page.goto('./');
  await input(page).setInputFiles(file('slow.json'));
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(state(page)).not.toContainText('계약 검증 성공');
  await input(page).setInputFiles(file('latest.json'));
  await expect(state(page)).toContainText('계약 검증 성공');
  await expect(state(page)).toContainText('latest.json');
  await expect(state(page)).not.toContainText('slow.json');
  await expect.poll(() => page.workers().length).toBe(0);
});
for (const action of ['검증 취소', '닫기']) {
  test(`${action} during processing clears file and Worker, then allows retry`, async ({ page }) => {
    await stallFirstWorker(page); await page.goto('./');
    await input(page).setInputFiles(file('pending.json'));
    await expect(page.getByRole('progressbar')).toBeVisible();
    if (action === '검증 취소') {
      await input(page).focus();
      await expect(input(page)).toBeFocused();
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: action, exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
    } else await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(state(page)).not.toContainText('pending.json');
    await expect(input(page)).toBeFocused();
    if (action === '검증 취소') await expect(state(page)).toContainText('취소했습니다');
    else await expect(state(page)).toBeEmpty();
    await expect.poll(() => page.workers().length).toBe(0);
    await input(page).setInputFiles(file('retry.json'));
    await expect(state(page)).toContainText('계약 검증 성공');
  });
}
test('Worker timeout clears previous success and produces actionable bounded error', async ({ page }) => {
  await page.goto('./');
  await input(page).setInputFiles(file('old.json'));
  await expect(state(page)).toContainText('계약 검증 성공');
  await stallFirstWorker(page);
  await input(page).setInputFiles(file('timeout.json'));
  await expect(state(page)).not.toContainText('old.json');
  await expect(state(page)).toContainText('ResourceLimitError', { timeout: 8000 });
  await expect(state(page)).toContainText('5초');
  await expect(state(page)).not.toContainText('계약 검증 성공');
  await expect.poll(() => page.workers().length).toBe(0);
});
test('Worker script failure is classified without keeping the last report', async ({ page }) => {
  await page.goto('./');
  await input(page).setInputFiles(file('old.json'));
  await expect(state(page)).toContainText('계약 검증 성공');
  await page.route('**/assets/import.worker-*.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'throw new Error("NATIVE_SECRET");'
  }));
  await input(page).setInputFiles(file('broken-worker.json'));
  await expect(state(page)).toContainText('WorkerError');
  await expect(state(page)).not.toContainText('NATIVE_SECRET');
  await expect(state(page)).not.toContainText('old.json');
  await expect.poll(() => page.workers().length).toBe(0);
});
test('keyboard can open, replace, close; completion and close have usable focus targets', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'JSON 보고서 열기' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '파일 열기로 이동' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: '보고서 가져오기' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input(page)).toBeFocused();
  const dialog = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await dialog).setFiles(file('keyboard.json'));
  await expect(state(page)).toContainText('계약 검증 성공');
  await expect(state(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(state(page)).toBeEmpty();
  await expect(input(page)).toBeFocused();
  const again = page.waitForEvent('filechooser');
  await page.keyboard.press('Space');
  await (await again).setFiles(file('again.json'));
  await expect(state(page)).toContainText('again.json');
  await expect(state(page)).toContainText('계약 검증 성공');
  await expect(state(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '다른 파일로 교체하기' })).toBeFocused();
  const replacement = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await replacement).setFiles(file('keyboard-replaced.json'));
  await expect(state(page)).toContainText('계약 검증 성공');
  await expect(state(page)).toContainText('keyboard-replaced.json');
});
test('invalid multiple-file Drop cancels a pending Worker and clears pending filename', async ({ page }) => {
  await stallFirstWorker(page); await page.goto('./');
  await input(page).setInputFiles(file('pending.json'));
  await expect(page.getByRole('progressbar')).toBeVisible();
  await drop(page, ['a.json', 'b.json']);
  await expect(state(page)).toContainText('MultipleFiles');
  await expect(state(page)).not.toContainText('pending.json');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
  await input(page).setInputFiles(file('retry.json'));
  await expect(state(page)).toContainText('계약 검증 성공');
});
for (const name of ['setup-error', 'cancelled']) {
  test(`synthetic ${name} remains a successful contract import`, async ({ page }) => {
    await page.goto('./');
    await input(page).setInputFiles(fixturePath(`synthetic/${name}.json`));
    await expect(state(page)).toContainText('계약 검증 성공');
  });
}
for (const name of ['execution-error', 'timeout', 'type-error', 'success-no-git']) {
  test(`evaluation fixture ${name} is a valid import, not an Import error`, async ({ page }) => {
    await page.goto('./');
    await input(page).setInputFiles(fixturePath(`official/${name}.json`));
    await expect(state(page)).toContainText('계약 검증 성공');
    await expect(state(page)).not.toContainText('SchemaError');
  });
}
test('decode/schema/oversize errors and arbitrary extensions are distinct', async ({ page }) => {
  await page.goto('./');
  for (const [buffer, code] of [[Buffer.from([255]), 'DecodeError'], [Buffer.from('{"schemaVersion":1}'), 'SchemaError'],
    [Buffer.alloc(10 * 1024 * 1024 + 1, 32), 'ResourceLimitError']] as const) {
    await input(page).setInputFiles({ name: 'input.json', mimeType: 'application/json', buffer });
    await expect(state(page)).toContainText(code);
    await expect(state(page)).not.toContainText('계약 검증 성공');
  }
  await input(page).setInputFiles({ ...file('report.txt'), mimeType: 'text/plain' });
  await expect(state(page)).toContainText('계약 검증 성공');
});
test('untrusted filenames stay bounded literal text; import fits mobile and dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await drop(page, ['<img src=x onerror=alert(1)>\u202e.json']);
  await expect(state(page)).toContainText('<img src=x onerror=alert(1)>\\u202e.json');
  await expect(page.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await drop(page, ['x'.repeat(1000)]);
  await expect(state(page)).toContainText('x'.repeat(256) + '…');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
