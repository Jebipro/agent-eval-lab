import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// A test-only extension controls real tab zoom. It is never part of the app/build.
test('real browser tab zoom 200%: reflow, reading and keyboard interaction', async ({}, info) => {
  const extension = info.outputPath('zoom-extension');
  mkdirSync(extension, { recursive: true });
  writeFileSync(extension + '/manifest.json', JSON.stringify({
    manifest_version: 3, name: 'Local zoom verification', version: '1.0',
    permissions: ['tabs'], host_permissions: ['http://127.0.0.1/*'],
    background: { service_worker: 'background.js' }
  }));
  writeFileSync(extension + '/background.js', 'chrome.runtime.onInstalled.addListener(()=>{});');
  const context = await chromium.launchPersistentContext(info.outputPath('zoom-profile'), {
    channel: info.project.use.channel ?? 'chromium', headless: true,
    viewport: { width: 1440, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 10000 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/agent-eval-lab/');
    const before = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    const zoom = await worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { tabs: {
        query(options: { url: string }): Promise<{ id: number }[]>;
        setZoom(id: number, zoom: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tabs = await api.query({ url: 'http://127.0.0.1/*' });
      if (!tabs[0]) throw new Error('No test tab');
      await api.setZoom(tabs[0].id, 2);
      return api.getZoom(tabs[0].id);
    });
    expect(zoom).toBe(2);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(before.width / 2);
    const after = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    expect(after.dpr).toBe(before.dpr * 2);
    await page.getByLabel('체험 예제 선택').selectOption('forbidden');
    await page.getByRole('button', { name: '선택한 예제 열기' }).click();
    await expect(page.getByRole('status')).toContainText('계약 검증 성공');
    const cdp = await context.newCDPSession(page);
    for (const theme of ['light', 'dark']) {
      await page.getByLabel('화면 테마').selectOption(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#overview').evaluate(n=>n.scrollIntoView({block:'start'}));
      // Capture the existing compositor surface without Playwright's viewport reset at non-100% tab zoom.
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      writeFileSync('.verification/phase4-zoom200-' + theme + '.png', Buffer.from(capture.data, 'base64'));
    }
    const summary = page.locator('.check-card').first().locator('summary').first();
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.check-card').first().locator('details').first()).toHaveAttribute('open', '');
    await page.getByRole('button', { name: '닫기', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByLabel('로컬 JSON 파일 선택')).toBeFocused();
    await expect(page.locator('.dashboard')).toHaveCount(0);
    await info.attach('actual-browser-zoom', { body: JSON.stringify({ zoom, before, after }), contentType: 'application/json' });
  } finally { await context.close(); }
});
