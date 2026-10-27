import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fixturePath } from '../tests/data-source';
import type { Report } from '../src/report/types';
import { observeImportNetwork } from './network-observer';
const report = (): Report => JSON.parse(readFileSync(fixturePath('official/success-no-git.json'),'utf8')) as Report;
const file = (r: Report | string, name='synthetic-comparison.json') => ({name,mimeType:'application/json',buffer:Buffer.from(typeof r==='string'?r:JSON.stringify(r))});
const aInput = (p:Page) => p.getByLabel('로컬 JSON 파일 선택',{exact:true});
const bInput = (p:Page) => p.getByLabel('B 로컬 JSON 파일 선택',{exact:true});
const bStatus = (p:Page) => p.locator('#comparison-import').getByRole('status');
for (const hostile of [false, true]) {
  test(`duplicate group navigation names and independent pages: ${hostile ? 'long literal IDs' : 'audit reproduction'}`, async ({page}) => {
    const a=report();
    const prefix=hostile ? '<img src=x onerror=alert(1)> & " 한글 '.repeat(30) : 'group-';
    const seed=a.checks[0]!;
    a.checks=Array.from({length:202},(_,i)=>({...seed,id:prefix+(i<101?'one':'two'),label:`Synthetic ${i}`}));
    await page.goto('./');await openA(page,a);await add(page);await openB(page,a);
    const rows=page.locator('.comparison-row');await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) for (const side of ['A','B']) {
      await row.getByText(`${side} 중복 원본 검사 펼치기`,{exact:true}).click();
    }
    const navs=rows.getByRole('navigation');await expect(navs).toHaveCount(4);
    const names=await navs.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
    expect(new Set(names).size).toBe(4);
    for (const side of ['A','B']) for (const index of [1,102]) {
      const name=names.find(n=>n?.startsWith(`${side} 중복 검사`) && n.includes(`#${index} ·`));
      expect(name).toBeTruthy();expect(name!.length).toBeLessThan(160);
      await expect(page.getByRole('navigation',{name:name!,exact:true})).toHaveCount(1);
    }
    const first=rows.nth(0).getByRole('navigation').nth(0);
    const second=rows.nth(1).getByRole('navigation').nth(0);
    await first.getByRole('button',{name:'다음 페이지'}).click();
    await expect(first).toContainText('2 / 2');await expect(second).toContainText('1 / 2');
    for (const row of await rows.all()) await expect(row.getByRole('navigation').nth(1)).toContainText('1 / 2');
    await second.getByRole('button',{name:'다음 페이지'}).click();
    await expect(first).toContainText('2 / 2');await expect(second).toContainText('2 / 2');
    await first.getByRole('button',{name:'이전 페이지'}).click();
    await expect(first).toContainText('1 / 2');await expect(second).toContainText('2 / 2');
    await expect(page.locator('.comparison-view img')).toHaveCount(0);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  });
}
async function openA(p:Page,r=report()) {await aInput(p).setInputFiles(file(r));await expect(p.locator('#import-panel').getByRole('status')).toContainText('계약 검증 성공');}
async function add(p:Page) {await p.getByRole('button',{name:'비교할 보고서 추가',exact:true}).click();await expect(bInput(p)).toBeFocused();}
async function openB(p:Page,r=report()) {await bInput(p).setInputFiles(file(r));await expect(bStatus(p)).toContainText('B 계약 검증 성공');}
async function tabTo(p:Page,target:Locator,key='Tab') {for(let i=0;i<60;i++){if(await target.evaluate(e=>e===document.activeElement))return;await p.keyboard.press(key);}throw Error('Keyboard target unreachable');}
async function stall(p:Page) {await p.route('**/assets/import.worker-*.js',r=>r.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{};'}));}

for (const theme of ['light','dark']) {
  test(`comparison filter layout and sequential keyboard focus: ${theme}`,async({page})=>{
    await page.goto('./');await page.getByLabel('화면 테마').selectOption(theme);await openA(page);await add(page);await openB(page);
    const search=page.getByLabel('비교 검사 ID 또는 이름 검색'),select=page.getByLabel('검사 변화 유형',{exact:true}),reset=page.getByRole('button',{name:'비교 필터 초기화'});
    for(const width of [1440,768,375,320]) {
      await page.setViewportSize({width,height:1000});
      const s=await search.boundingBox(),t=await select.boundingBox(),r=await reset.boundingBox(),g=await page.locator('.comparison-filters').boundingBox(),count=await page.locator('.comparison-count').boundingBox();
      expect(s&&t&&r&&g&&count).toBeTruthy();
      if(width===1440){expect(Math.abs(s!.y-t!.y)).toBeLessThan(2);expect(s!.width).toBeGreaterThan(t!.width);expect(t!.width).toBeLessThanOrEqual(224);expect(r!.x).toBeGreaterThan(t!.x+t!.width);}
      else {expect(t!.y).toBeGreaterThan(s!.y+s!.height);expect(r!.y).toBeGreaterThan(t!.y+t!.height);}
      expect(Math.abs(r!.x+r!.width-g!.x-g!.width)).toBeLessThan(2);expect(count!.y).toBeGreaterThan(g!.y+g!.height);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await tabTo(page,search,width===1440?'Tab':'Shift+Tab');await expect(search).toBeFocused();
      expect(await search.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
      await page.keyboard.press('Tab');await expect(select).toBeFocused();await page.keyboard.press('Tab');await expect(reset).toBeFocused();
      await page.locator('.comparison-filters').screenshot({path:`.verification/phase7b3/filters-${theme}-${width}.png`});
    }
    expect((await new AxeBuilder({page}).include('.comparison-view').analyze()).violations).toEqual([]);
  });
}

test('A/B originals, incomparable definition, Git snapshots and filter empty/reset',async({page})=>{
  const a=report(),b=report();b.checks[0]!.status='fail';b.checks[1]!.required=false;b.checks[1]!.status='error';b.score=50;
  await page.goto('./');await openA(page,a);await add(page);await openB(page,b);
  const view=page.getByRole('region',{name:'두 보고서 비교',exact:true});
  await expect(view.getByRole('region',{name:'A · 이전(Before)',exact:true})).toContainText('100');
  await expect(view.getByRole('region',{name:'B · 이후(After)',exact:true})).toContainText('50');
  await expect(view).toContainText('원시 점수 차이 (B − A): -50');
  await expect(page.locator('.comparison-row').first()).toContainText('상태 변경');
  await expect(page.locator('.comparison-row').nth(1)).toContainText('비교 불가');
  await expect(page.locator('.comparison-row').nth(1)).toContainText('검사 정의 변경: required');
  await expect(page.locator('.comparison-row').nth(1)).toContainText('통과 (pass)');
  await expect(page.locator('.comparison-row').nth(1)).toContainText('오류 (error)');
  await expect(view.getByRole('region',{name:'A Git snapshot',exact:true})).toContainText('Git 검사 비활성');
  await expect(view.getByRole('region',{name:'B Git snapshot',exact:true})).toContainText('Git 검사 비활성');
  await page.getByLabel('검사 변화 유형',{exact:true}).selectOption('incomparable');await expect(page.locator('.comparison-row')).toHaveCount(1);
  await page.getByLabel('비교 검사 ID 또는 이름 검색').fill('missing');await expect(page.locator('.comparison-row')).toHaveCount(0);
  await expect(view).toContainText('조건에 맞는 비교 결과가 없습니다.');
  await page.getByRole('button',{name:'비교 필터 초기화'}).click();await expect(page.locator('.comparison-row')).toHaveCount(2);
});
test('B failure and same-run replacement clear old B; native picker cancellation preserves current B',async({page})=>{
  await page.goto('./');await openA(page);await add(page);await openB(page);
  await bInput(page).setInputFiles([]);await expect(page.locator('.comparison-view')).toBeVisible();
  await bInput(page).setInputFiles(file('{PRIVATE_PARSE_TEXT'));await expect(bStatus(page)).toContainText('ParseError');
  await expect(page.locator('.comparison-view')).toHaveCount(0);await expect(page.locator('#overview')).toBeVisible();await expect(page.locator('body')).not.toContainText('PRIVATE_PARSE_TEXT');
  const b=report();b.checks[0]!.status='fail';await openB(page,b);await page.getByLabel('비교 검사 ID 또는 이름 검색').fill('missing');
  b.checks[0]!.status='error';await openB(page,b);await expect(page.getByLabel('비교 검사 ID 또는 이름 검색')).toHaveValue('');
  await expect(page.locator('.comparison-row').first()).toContainText('오류 (error)');
  await page.getByRole('button',{name:'비교 종료 · B 닫기'}).click();await expect(page.getByRole('button',{name:'비교할 보고서 추가',exact:true})).toBeFocused();
  await expect(page.locator('#overview')).toBeVisible();await expect(bInput(page)).toHaveCount(0);
  await expect(page.locator('.check-card').first()).toContainText('통과 (pass)');
});
test('B cancellation, timeout and replacement terminate Worker and preserve A',async({page})=>{
  await page.goto('./');await openA(page);await add(page);await stall(page);
  await bInput(page).setInputFiles(file(report(),'pending.json'));await expect(page.getByRole('progressbar',{name:'B 보고서 검증 중'})).toBeVisible();
  await page.getByRole('button',{name:'B 검증 취소'}).click();await expect(bInput(page)).toBeFocused();await expect(bStatus(page)).toContainText('B 검증을 취소');
  await expect(page.locator('#overview')).toBeVisible();await expect.poll(()=>page.workers().length).toBe(0);
  await bInput(page).setInputFiles(file(report(),'timeout.json'));await expect(bStatus(page)).toContainText('ResourceLimitError',{timeout:8000});
  await expect(page.locator('#overview')).toBeVisible();await expect.poll(()=>page.workers().length).toBe(0);
  await bInput(page).setInputFiles(file(report(),'old.json'));await expect(page.getByRole('progressbar')).toBeVisible();
  await page.unroute('**/assets/import.worker-*.js');await openB(page);await expect(bStatus(page)).not.toContainText('old.json');await expect.poll(()=>page.workers().length).toBe(0);
});
test('A replacement, A example and close unmount B including a pending Worker',async({page})=>{
  await page.goto('./');await openA(page);await add(page);await openB(page);
  const a=report();a.checks[0]!.status='fail';await openA(page,a);await expect(bInput(page)).toHaveCount(0);await expect(page.locator('.comparison-view')).toHaveCount(0);await expect(page.locator('.check-card').first()).toContainText('실패 (fail)');
  await add(page);await openB(page);await page.getByLabel('체험 예제 선택',{exact:true}).selectOption('success');await page.getByRole('button',{name:'선택한 예제 열기',exact:true}).click();
  await expect(page.locator('#overview')).toBeVisible();await expect(bInput(page)).toHaveCount(0);
  await add(page);await stall(page);await bInput(page).setInputFiles(file(report()));await expect(page.getByRole('progressbar')).toBeVisible();
  await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(aInput(page)).toBeFocused();await expect(page.locator('.dashboard')).toHaveCount(0);await expect(bInput(page)).toHaveCount(0);await expect.poll(()=>page.workers().length).toBe(0);
});
test('B approved example uses Worker and can be replaced by a local file',async({page})=>{
  await page.goto('./');await openA(page);await add(page);
  await page.getByLabel('B 체험 예제 선택',{exact:true}).selectOption('success');const worker=page.waitForEvent('worker');
  await page.getByRole('button',{name:'B 선택한 예제 열기',exact:true}).click();await worker;await expect(bStatus(page)).toContainText('B 계약 검증 성공');
  const b=report();b.project.name='Local replacement';await openB(page,b);await expect(page.locator('.comparison-view')).toContainText('Local replacement');
});
for (const action of ['local-B','cancel-B','replace-A'] as const) {
  test(`late B example response cannot overwrite ${action}`,async({page})=>{
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route(/\/assets\/example-data-[^/]+\.js$/,async route=>{await gate;await route.continue().catch(()=>{});});
    await page.goto('./');await openA(page);await add(page);
    await page.getByLabel('B 체험 예제 선택',{exact:true}).selectOption('success');await page.getByRole('button',{name:'B 선택한 예제 열기',exact:true}).click();
    await expect(page.getByRole('progressbar',{name:'B 보고서 검증 중'})).toBeVisible();
    if(action==='local-B'){const b=report();b.project.name='Latest B';await openB(page,b);}
    else if(action==='cancel-B')await page.getByRole('button',{name:'B 검증 취소'}).click();
    else {const a=report();a.project.name='Latest A';await openA(page,a);}
    release();await page.waitForLoadState('networkidle');
    if(action==='local-B')await expect(page.locator('.comparison-view')).toContainText('Latest B');
    else {await expect(page.locator('.comparison-view')).toHaveCount(0);await expect(page.locator('#overview')).toBeVisible();}
    if(action==='replace-A'){await expect(page.locator('#overview')).toContainText('Latest A');await expect(bInput(page)).toHaveCount(0);}
    if(action==='cancel-B')await expect(bStatus(page)).toContainText('B 검증을 취소');
    await expect.poll(()=>page.workers().length).toBe(0);
  });
}
test('205 comparison rows paginate in original order and reset page on filters',async({page})=>{
  const a=report();a.checks=Array.from({length:205},(_,i)=>({...a.checks[0]!,id:`id-${i}`,label:`Label ${i}`}));const b=structuredClone(a);b.checks[0]!.status='fail';
  await page.goto('./');await openA(page,a);await add(page);await openB(page,b);
  const nav=page.getByRole('navigation',{name:'검사 비교 목록 페이지'});await expect(page.locator('.comparison-row')).toHaveCount(100);
  await nav.getByRole('button',{name:'다음 페이지'}).click();await expect(page.locator('.comparison-row').first()).toContainText('id-100');
  await page.getByLabel('검사 변화 유형',{exact:true}).selectOption('status-unchanged');await expect(nav).toContainText('1 / 3');await expect(page.locator('.comparison-row').first()).toContainText('id-1');
  await nav.getByRole('button',{name:'다음 페이지'}).click();await page.getByLabel('비교 검사 ID 또는 이름 검색').fill('id-20');await expect(page.locator('.comparison-row')).toHaveCount(6);await expect(nav).toHaveCount(0);
  await page.getByRole('button',{name:'비교 필터 초기화'}).click();await expect(nav).toContainText('1 / 3');
});
test('keyboard add, import, filter, page, end and axe at narrow viewport',async({page})=>{
  await page.goto('./');const a=report();a.checks=Array.from({length:101},(_,i)=>({...a.checks[0]!,id:String(i)}));await openA(page,a);
  await tabTo(page,page.getByRole('button',{name:'비교할 보고서 추가',exact:true}));await page.keyboard.press('Enter');await expect(bInput(page)).toBeFocused();
  const dialog=page.waitForEvent('filechooser');await page.keyboard.press('Enter');await (await dialog).setFiles(file(a));await expect(bStatus(page)).toContainText('B 계약 검증 성공');
  await tabTo(page,page.getByLabel('비교 검사 ID 또는 이름 검색'));await page.keyboard.type('missing');await expect(page.locator('.comparison-count')).toContainText('0행');
  await tabTo(page,page.getByRole('button',{name:'비교 필터 초기화'}));await page.keyboard.press('Enter');
  await tabTo(page,page.getByRole('navigation',{name:'검사 비교 목록 페이지'}).getByRole('button',{name:'다음 페이지'}));await page.keyboard.press('Enter');await expect(page.locator('.comparison-row')).toHaveCount(1);
  await page.setViewportSize({width:375,height:812});expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await tabTo(page,page.getByRole('button',{name:'비교 종료 · B 닫기'}),'Shift+Tab');await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'비교할 보고서 추가',exact:true})).toBeFocused();await expect(page.locator('#overview')).toBeVisible();
});
test('two local files and comparison query stay text-only, offline, out of storage/URL/console',async({page,browserName})=>{
  const sentinel='COMPARISON_PRIVATE_729';const a=report(),b=report();a.project.name=b.project.name=`<img src=x onerror=alert(1)>${sentinel}`;
  a.checks[0]!.label=b.checks[0]!.label=`<script>${sentinel}</script>`;
  const verify=observeImportNetwork(page),messages:string[]=[],sockets:string[]=[];
  page.on('console',m=>messages.push(m.text()));page.on('pageerror',e=>messages.push(e.message));page.on('websocket',s=>sockets.push(s.url()));
  await page.goto('./');await aInput(page).setInputFiles(file(a,sentinel+'.json'));await expect(page.locator('#overview')).toBeVisible();
  await verify(browserName,Buffer.from(JSON.stringify(a)),sentinel);
  // Observe each import separately: WebKit's exact local Blob read belongs to one payload.
  const verifyB=observeImportNetwork(page);await add(page);
  await bInput(page).setInputFiles(file(b,sentinel+'B.json'));await expect(bStatus(page)).toContainText('B 계약 검증 성공');
  await page.getByLabel('비교 검사 ID 또는 이름 검색').fill(sentinel);await expect(page.locator('.comparison-row')).toHaveCount(1);await expect(page.locator('img')).toHaveCount(0);
  await verifyB(browserName,Buffer.from(JSON.stringify(b)),sentinel);expect(messages).toEqual([]);expect(sockets).toEqual([]);expect(page.url()).not.toContain(sentinel);
  expect(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,db:await indexedDB.databases(),cache:await caches.keys()}))).toEqual({local:0,session:0,db:[],cache:[]});
  await page.reload();await expect(page.locator('body')).not.toContainText(sentinel);await expect(page.locator('.comparison-view')).toHaveCount(0);
});
