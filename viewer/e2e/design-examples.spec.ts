import { expect, test, type Page, type Locator } from '@playwright/test';
import { installFocusDiagnostics, recordFocusStep, readFocusDiagnostics } from './focus-diagnostics';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import manifest from '../samples/manifest.json' with { type: 'json' };
import { fixturePath } from '../tests/data-source';

async function example(page: Page, id: string) {
  await page.getByLabel('체험 예제 선택').selectOption(id);
  await page.getByRole('button', { name: '선택한 예제 열기' }).click();
}
async function ready(page: Page) { await expect(page.getByRole('status')).toContainText('계약 검증 성공'); }
async function tabTo(page: Page, target: Locator, direction: 'Tab' | 'Shift+Tab' = 'Tab', diagnose = false) {
  for (let i=0; i<100; i++) {
    if (await target.evaluate(node => node === document.activeElement)) return;
    if (diagnose) await recordFocusStep(page, 'before', direction);
    await page.keyboard.press(direction);
    if (diagnose) await recordFocusStep(page, 'after', direction);
  }
  throw new Error('Keyboard target not reached');
}

for (const item of manifest.entries) {
  test('reviewed example through Worker: ' + item.id, async ({ page }) => {
    await page.goto('./');
    const started = page.waitForEvent('worker'); await example(page, item.id); await started; await ready(page);
    const report = JSON.parse(readFileSync(new URL('../'+item.source, import.meta.url), 'utf8'));
    await expect(page.getByRole('status')).toContainText(item.kind === 'official' ? '공식 실행 기록' : '합성 예제');
    await expect(page.getByRole('status')).toContainText('공개 승인 예제');
    await expect(page.locator('#overview')).toContainText(report.run.id);
    await expect(page.locator('#overview')).toContainText('('+report.status+')');
    await expect(page.locator('#overview')).toContainText(report.score === null ? '산정되지 않음 (null)' : report.score+'점');
    await expect(page.locator('#overview')).toContainText(report.summary.pass+' / '+report.summary.total);
    await expect(page.getByRole('status')).toBeFocused();
  });
}

test('example/local/reselect/close transitions clear old report, log and source', async ({ page }) => {
  await page.goto('./'); await example(page, 'failure'); await ready(page);
  await page.locator('.check-card').first().locator('summary').first().click();
  await page.locator('.check-card').first().locator('summary').filter({ hasText: 'stdout 펼치기' }).click();
  await page.getByLabel('로그 검색 (일반 문자열·대소문자 구분)').fill('vitest');
  await expect(page.locator('.search-state')).toContainText('개 일치');
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles(fixturePath('scenario/normal.json')); await ready(page);
  await expect(page.getByRole('status')).toContainText('로컬 파일');
  await expect(page.getByRole('status')).not.toContainText('공개 승인 예제');
  await expect(page.locator('textarea')).toHaveCount(0);
  await example(page, 'setup'); await ready(page); await expect(page.locator('#overview')).toContainText('산정되지 않음');
  await example(page, 'success'); await ready(page);
  await example(page, 'success'); await ready(page);
  await page.getByRole('button', {name:'닫기',exact:true}).click();
  await expect(page.getByRole('status')).toBeEmpty(); await expect(page.locator('.dashboard')).toHaveCount(0);
  await expect(page.getByLabel('체험 예제 선택')).toHaveValue('');
  await expect(page.getByLabel('로컬 JSON 파일 선택')).toBeFocused();
});

for (const action of ['local', 'cancel', 'close'] as const) {
  test('delayed example cannot overwrite ' + action, async ({page}) => {
    let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route(/\/assets\/example-data-[^/]+\.js$/, async route=>{await gate;await route.continue().catch(()=>{});});
    await page.goto('./'); await example(page,'success'); await expect(page.getByRole('progressbar')).toBeVisible();
    if(action==='local') { await page.getByLabel('로컬 JSON 파일 선택').setInputFiles(fixturePath('scenario/normal.json')); await ready(page); }
    else await page.getByRole('button',{name:action==='close'?'닫기':'검증 취소',exact:true}).click();
    release(); await page.waitForLoadState('networkidle');
    if(action==='local') { await expect(page.getByRole('status')).toContainText('로컬 파일'); await expect(page.locator('#overview')).toContainText('3 / 3'); }
    else { await expect(page.locator('.dashboard')).toHaveCount(0); await expect(page.getByRole('status')).not.toContainText('계약 검증 성공'); }
  });
}
test('example module failure removes previous result and provides recovery',async({page})=>{
  await page.route(/\/assets\/example-data-[^/]+\.js$/,route=>route.abort());
  await page.goto('./'); await page.getByLabel('로컬 JSON 파일 선택').setInputFiles(fixturePath('scenario/normal.json'));await ready(page);
  await example(page,'success');await expect(page.getByRole('status')).toContainText('ReadError');
  await expect(page.locator('.dashboard')).toHaveCount(0);await expect(page.getByRole('status')).toBeFocused();
  await page.getByLabel('로컬 JSON 파일 선택').setInputFiles(fixturePath('scenario/normal.json'));await ready(page);
});
test('rapid example replacement accepts only the latest choice',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route(/\/assets\/example-data-[^/]+\.js$/,async route=>{await gate;await route.continue().catch(()=>{});});
  await page.goto('./');await example(page,'success');await expect(page.getByRole('progressbar')).toBeVisible();
  await example(page,'setup');release();await ready(page);
  await expect(page.locator('#overview')).toContainText('산정되지 않음 (null)');
  await expect(page.getByRole('status')).toContainText('합성 예제');
  await expect(page.getByLabel('체험 예제 선택')).toHaveValue('setup');
});
test('corrupt example still goes through syntax/schema validation',async({page})=>{
  await page.route(/\/assets\/example-data-[^/]+\.js$/,route=>route.fulfill({contentType:'application/javascript',body:'export const payloads = {success: "{PRIVATE_EXAMPLE_BAD", setup: "{\\"schemaVersion\\":2}"};'}));
  await page.goto('./');await example(page,'success');await expect(page.getByRole('status')).toContainText('ParseError');
  await expect(page.locator('body')).not.toContainText('PRIVATE_EXAMPLE_BAD');await expect(page.locator('.dashboard')).toHaveCount(0);
  await example(page,'setup');await expect(page.getByRole('status')).toContainText('UnsupportedVersion');
});
test('example loading has a five-second deadline with late result ignored',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route(/\/assets\/example-data-[^/]+\.js$/,async route=>{await gate;await route.continue().catch(()=>{});});
  await page.goto('./');await example(page,'success');
  await expect(page.getByRole('status')).toContainText('ReadError',{timeout:8000});release();await page.waitForLoadState('networkidle');
  await expect(page.locator('.dashboard')).toHaveCount(0);await expect(page.getByRole('status')).toContainText('ReadError');
});

test('System follows changes; manual Light/Dark override and reset on reload without storage',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});await page.goto('./');
  const theme=page.getByLabel('화면 테마');await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await theme.selectOption('dark');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await theme.selectOption('light');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await theme.selectOption('system');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await theme.selectOption('light');await example(page,'optional');await ready(page);
  expect(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,db:await indexedDB.databases(),cache:await caches.keys()}))).toEqual({local:0,session:0,db:[],cache:[]});
  await page.reload();await expect(theme).toHaveValue('system');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('.dashboard')).toHaveCount(0);
});

for(const theme of ['light','dark']){
  test('automated accessibility and screenshots: '+theme,async({page},testInfo)=>{
    test.setTimeout(90000);await page.setViewportSize({width:1440,height:1000});await page.goto('./');
    await page.getByLabel('화면 테마').selectOption(theme);
    for(const state of ['empty','report','setup','import-error']){
      if(state==='report') {await example(page,'failure');await ready(page);await page.locator('.check-card').first().locator('summary').first().click();await page.locator('.check-card').first().locator('summary').filter({hasText:'stderr 펼치기'}).click();}
      if(state==='setup') {await example(page,'setup');await ready(page);}
      if(state==='import-error') await page.getByLabel('로컬 JSON 파일 선택').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
      if(state==='import-error') await expect(page.getByRole('status')).toContainText('ParseError');
      const result=await new AxeBuilder({page}).analyze();
      await testInfo.attach('axe-'+theme+'-'+state,{body:JSON.stringify({violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(p=>p.id)}),contentType:'application/json'});
      expect(result.violations).toEqual([]);
      if(state==='empty') await page.screenshot({path:'.verification/phase4-'+theme+'-empty-desktop.png',fullPage:true});
      if(state==='report') {await page.locator('#overview').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:'.verification/phase4-'+theme+'-dashboard-desktop.png'});}
    }
  });
}
for(const width of [320,375,768,1440]){
  test('responsive reading and touch targets at '+width,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('./');await example(page,'forbidden');await ready(page);
    await page.getByLabel('화면 테마').selectOption('dark');
    await page.locator('.check-card').first().locator('summary').first().click();
    await page.locator('.check-card').first().locator('summary').filter({hasText:'stdout 펼치기'}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const small=await page.locator('button,select,input[type=file],summary,.section-links a').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0).filter(n=>n.getBoundingClientRect().height<44).map(n=>n.tagName));
    expect(small).toEqual([]);
    await page.locator('#overview').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:'.verification/phase4-dark-'+width+'.png'});
    await page.getByLabel('화면 테마').selectOption('light');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width===375) {await page.locator('#checks').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:'.verification/phase4-light-checks-mobile.png'});}
  });
}
for (const direction of ['Tab', 'Shift+Tab'] as const) {
test('keyboard-only theme, example, navigation, log search and close; reduced motion' + (direction === 'Tab' ? '' : ' (reverse close)'),async({page}, testInfo)=>{
  await installFocusDiagnostics(page);
  try {
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');
  await tabTo(page,page.getByLabel('화면 테마'));await expect(page.getByLabel('화면 테마')).toBeFocused();
  await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByLabel('화면 테마')).toHaveValue('light');
  await tabTo(page,page.getByLabel('체험 예제 선택'));await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByLabel('체험 예제 선택')).toHaveValue('success');
  await tabTo(page,page.getByRole('button',{name:'선택한 예제 열기'}));await expect(page.getByRole('button',{name:'선택한 예제 열기'})).toBeFocused();await page.keyboard.press('Enter');await ready(page);
  await tabTo(page,page.getByRole('link',{name:'검사 결과',exact:true}));await page.keyboard.press('Enter');
  const summary=page.locator('.check-card').first().locator('summary').first();await tabTo(page,summary);await page.keyboard.press('Enter');
  const stdout=page.locator('.check-card').first().locator('summary').filter({hasText:'stdout 펼치기'});await tabTo(page,stdout);await page.keyboard.press('Space');
  const query=page.getByLabel('로그 검색 (일반 문자열·대소문자 구분)');await tabTo(page,query);await page.keyboard.type('vitest');
  await expect(page.locator('.search-state')).toContainText('개 일치');
  const focus=await query.evaluate(node=>({width:getComputedStyle(node).outlineWidth,style:getComputedStyle(node).outlineStyle}));expect(focus).toEqual({width:'3px',style:'solid'});
  expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.panel')!).animationName)).toBe('none');
  await tabTo(page,page.getByRole('button',{name:'닫기',exact:true}), direction, true);await page.keyboard.press('Enter');
  await expect(page.getByLabel('로컬 JSON 파일 선택')).toBeFocused();await expect(page.locator('.dashboard')).toHaveCount(0);
  } finally {
    await testInfo.attach('focus-diagnostics', { body: JSON.stringify(await readFocusDiagnostics(page)), contentType: 'application/json' });
  }
});
}
