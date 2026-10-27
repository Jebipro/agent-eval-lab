import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath } from '../tests/data-source';
import type { Report } from '../src/report/types';
const report = (): Report => JSON.parse(readFileSync(fixturePath('official/success-no-git.json'), 'utf8')) as Report;
async function open(page: Page, r: Report) {
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles({ name: 'synthetic-filter.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(r)) });
  await expect(page.getByRole('status')).toContainText('계약 검증 성공');
}
async function tabTo(page: Page, target: Locator) {
  for (let i=0; i<100; i++) { if (await target.evaluate(e => e === document.activeElement)) return; await page.keyboard.press('Tab'); }
  throw Error('Keyboard target not reached');
}
test('filters combine without changing overview; literal search, empty result, logs and keyboard reset', async ({page}) => {
  const r=report(); const seed=r.checks[0]!;
  r.checks=[{...seed,id:'literal[.*]',label:'한글 <img>',status:'fail',required:false,stdout:'public needle needle'}, {...seed,id:'second',label:'Second',status:'error'}, {...seed,id:'third',label:'Third',status:'skipped'}];
  await page.goto('./'); await open(page,r); const original=await page.locator('#overview').innerText();
  await tabTo(page,page.getByLabel('검사 ID 또는 이름 검색')); await page.keyboard.type('[.*]');
  await tabTo(page,page.getByLabel('검사 상태 필터')); await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await tabTo(page,page.getByLabel('필수 여부 필터'));await page.keyboard.press('End');await page.keyboard.press('Enter');
  await expect(page.locator('.check-card')).toHaveCount(1);await expect(page.locator('.check-filter-count')).toContainText('필터 결과 1개 / 전체 검사 기록 3개');
  expect(await page.locator('#overview').innerText()).toBe(original);await expect(page.locator('#checks img')).toHaveCount(0);
  await page.locator('.check-card summary').first().click();await page.locator('summary').filter({hasText:'stdout 펼치기'}).click();
  await page.getByLabel('로그 검색 (일반 문자열·대소문자 구분)').fill('needle');await expect(page.locator('.search-state')).toContainText('2개 일치');
  await page.getByLabel('필수 여부 필터').selectOption('required');await expect(page.locator('.check-card')).toHaveCount(0);await expect(page.getByText('조건에 맞는 검사 결과가 없습니다.',{exact:false})).toBeVisible();
  await tabTo(page,page.getByRole('button',{name:'검사 필터 초기화'}));await page.keyboard.press('Enter');await expect(page.locator('.check-card')).toHaveCount(3);await expect(page.getByLabel('검사 ID 또는 이름 검색')).toHaveValue('');
});
test('pagination retains source indices and resets on every filter change', async ({page}) => {
  const r=report(),seed=r.checks[0]!;r.checks=Array.from({length:205},(_,i)=>({...seed,id:`id-${i}`,label:`Label ${i}`,status:i%2?'fail':'pass',required:i%2===0}));
  await page.goto('./');await open(page,r);const nav=page.getByRole('navigation',{name:'검사 목록 페이지'});
  await expect(page.locator('.check-card')).toHaveCount(100);await tabTo(page,nav.getByRole('button',{name:'다음 페이지'}));await page.keyboard.press('Enter');await expect(page.locator('.check-card').first()).toHaveAttribute('aria-label','검사 101');
  await page.getByLabel('검사 상태 필터').selectOption('pass');await expect(nav).toContainText('1 / 2');await expect(page.locator('.check-card').first()).toHaveAttribute('aria-label','검사 1');
  await nav.getByRole('button',{name:'다음 페이지'}).click();await expect(page.locator('.check-card')).toHaveCount(3);
  await page.getByLabel('필수 여부 필터').selectOption('required');await expect(nav).toContainText('1 / 2');
  await nav.getByRole('button',{name:'다음 페이지'}).click();await page.getByLabel('검사 ID 또는 이름 검색').fill('id-20');await expect(page.locator('.check-card')).toHaveCount(4);await expect(nav).toHaveCount(0);
  await page.getByRole('button',{name:'검사 필터 초기화'}).click();await expect(nav).toContainText('1 / 3');
});
test('replacement, same report ID, close and examples reset filters',async({page})=>{
  const r=report();await page.goto('./');await open(page,r);
  async function dirty(){await page.getByLabel('검사 ID 또는 이름 검색').fill('missing');await page.getByLabel('검사 상태 필터').selectOption('error');await page.getByLabel('필수 여부 필터').selectOption('optional');}
  async function clean(){await expect(page.getByLabel('검사 ID 또는 이름 검색')).toHaveValue('');await expect(page.getByLabel('검사 상태 필터')).toHaveValue('all');await expect(page.getByLabel('필수 여부 필터')).toHaveValue('all');}
  await dirty();await open(page,r);await clean();await dirty();await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(page.locator('#checks')).toHaveCount(0);await open(page,r);await clean();await dirty();await page.getByLabel('체험 예제 선택').selectOption('success');await page.getByRole('button',{name:'선택한 예제 열기'}).click();await expect(page.getByRole('status')).toContainText('공개 승인 예제');await clean();
});
