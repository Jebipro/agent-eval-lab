import { test, expect } from '@playwright/test';
import { fixturePath } from '../tests/data-source';

test('skip link and all result anchors are reachable by Tab in every engine', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'JSON 보고서 열기' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '파일 열기로 이동' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: '보고서 가져오기' })).toBeFocused();
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles(fixturePath('scenario/normal.json'));
  await expect(page.getByRole('status')).toContainText('계약 검증 성공');
  for (const name of ['평가 개요', '검사 결과', 'Git 변경', '평가 진단']) {
    const target = page.getByRole('link', { name, exact: true });
    for (let i = 0; i < 80; i++) {
      if (await target.evaluate(node => node === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(target).toBeFocused();
  }
});
