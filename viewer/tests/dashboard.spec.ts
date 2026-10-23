import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Dashboard } from '../src/components/Dashboard';
import { CheckDetails, Checks, Violations } from '../src/components/Checks';
import { LogContent, LogPanel } from '../src/components/LogPanel';
import { consistencyWarnings } from '../src/report/consistency';
import { LOG_PAGE_SIZE, QUERY_LIMIT, SEARCH_LIMIT, searchLog, visibleLog } from '../src/report/log-search';
import { bytes, fixture } from './helpers';
import { parseBytes } from '../src/import/parse';
import type { Report } from '../src/report/types';

const render = (report: Report) => renderToStaticMarkup(createElement(Dashboard, { report }));
const rawSearch = (text: string, query: string) => searchLog(text, query, new AbortController().signal, async () => {});

describe('actual component output preserves report fields', () => {
  test.each([
    ['normal', 'passed', 0, 100, 3, 3], ['test-failure', 'failed', 1, 67, 2, 3],
    ['forbidden-change', 'failed', 1, 75, 3, 4], ['restored', 'passed', 0, 100, 4, 4]
  ] as const)('%s values and snapshot meaning', (name, status, exit, score, pass, total) => {
    const r = fixture(`scenario/${name}.json`); const before = JSON.stringify(r); const html = render(r);
    expect(html).toContain(`(${status})`); expect(html).toContain(`${score}점`);
    expect(html).toContain(`${pass} / ${total}`);
    expect(html).toContain(`<dt>실제 종료 코드</dt><dd>${exit}</dd>`);
    for (const value of [r.run.id, r.run.startedAt, r.run.endedAt, r.tool.version, r.git!.baseSha!]) expect(html).toContain(value);
    expect(html).toContain(`${r.run.durationMs} ms`);
    expect(html).toContain('before-commands'); expect(html).toContain('알 수 없음 (null)');
    expect(html).toContain('scoreComplete=true'); expect(html).toContain('전체 줄 수가 아닙니다.');
    expect(consistencyWarnings(r)).toEqual([]); expect(JSON.stringify(r)).toBe(before);
  });
  test.each(['execution-error', 'timeout', 'success-no-git', 'test-failure', 'type-error', 'forbidden-file', 'requirements'])(
    'official %s is valid and has no invented consistency errors', name => {
      const r = fixture(`official/${name}.json`); expect(parseBytes(bytes(r)).ok).toBe(true);
      const html = render(r); expect(html).toContain(`(${r.status})`);
      expect(consistencyWarnings(r)).toEqual([]);
    });
  test.each(['setup-error', 'cancelled', 'optional-failure', 'truncated-log'])('synthetic %s retains special meaning', name => {
    const r = fixture(`synthetic/${name}.json`); const html = render(r);
    expect(html).toContain(`(${r.status})`); expect(consistencyWarnings(r)).toEqual([]);
    if (r.score === null) { expect(html).toContain('산정되지 않음 (null)'); expect(html).not.toContain('0점'); }
    if (!r.scoreComplete) expect(html).toContain('불완전 점수 (scoreComplete=false)');
    if (r.git === null) expect(html).toContain('Git 분석 결과 없음 (git=null)');
  });
  test('disabled, missing and active Git are distinct', () => {
    expect(render(fixture('official/success-no-git.json'))).toContain('Git 검사 비활성');
    expect(render(fixture('synthetic/setup-error.json'))).not.toContain('Git 검사 비활성');
    expect(render(fixture())).not.toContain('Git 검사 비활성');
  });
  test('unknown/rename/binary status and nullable counts remain literal', () => {
    const r = fixture(); r.git!.changes = [{ status: 'custom-status', path: '새 경로', oldPath: '이전 경로',
      binary: true, additions: null, deletions: 0 }];
    const html = render(r);
    for (const s of ['custom-status', '새 경로', '이전 경로', '<dt>추가 줄</dt><dd>알 수 없음 (null)</dd>', '<dt>삭제 줄</dt><dd>0</dd>']) expect(html).toContain(s);
  });
  test('optional command properties: absent, empty, null, false and true', () => {
    const c = fixture().checks[0]!;
    delete c.command; delete c.args; delete c.stdout; c.stderr = ''; c.signal = null; c.timedOut = true; c.outputTruncated = true;
    const html = renderToStaticMarkup(createElement(CheckDetails, { check: c }));
    for (const text of ['<dt>실행 파일</dt><dd>미제공', 'stdout: 미제공', 'stderr: 빈 출력', '없음 (null)', 'CLI가 출력을 잘랐음', '예 (true)']) expect(html).toContain(text);
  });
  test('command and arguments are separate JSON text, never a runnable shell string', () => {
    const c = fixture().checks[0]!; c.command = 'npm.cmd'; c.args = ['a & b', '한글 경로'];
    const html = renderToStaticMarkup(createElement(CheckDetails, { check: c }));
    expect(html).toContain('npm.cmd'); expect(html).toContain('[&quot;a &amp; b&quot;,&quot;한글 경로&quot;]');
    expect(html).not.toContain('href=');
  });
  test('nullable forbidden exit and violations are not fabricated command failures', () => {
    const r = fixture('scenario/forbidden-change.json');
    expect(render(r)).toContain('종료 코드 없음 (null)');
    expect(render(r)).toContain('일치 패턴:');
    expect(render(r)).toContain('package.json');
    expect(render(fixture('scenario/restored.json'))).toContain('기록된 위반 없음');
  });
  test('diagnostic code/message/hint are rendered separately from Viewer warnings', () => {
    const r = fixture(); r.errors = [{ code: 'E_TEST', message: '문제 설명', hint: '다음 행동' }];
    r.warnings = [{ code: 'W_TEST', message: '알림 설명', hint: '확인 행동' }];
    const html = render(r);
    for (const text of ['CLI errors', 'CLI warnings', 'E_TEST', '문제 설명', '다음 행동', 'W_TEST', 'Viewer 일관성 경고']) expect(html).toContain(text);
  });
  test('schema-valid contradictions warn without correcting values or merging CLI diagnostics', () => {
    const r = fixture(); r.summary.pass = 41; r.summary.total = 72; r.score = 42; r.exitCode = 2;
    r.checks[1]!.id = r.checks[0]!.id;
    expect(parseBytes(bytes(r)).ok).toBe(true); const before = JSON.stringify(r);
    const warnings = consistencyWarnings(r);
    expect(warnings).toHaveLength(4); expect(warnings.some(s => s.includes('중복 id'))).toBe(true);
    const html = render(r); expect(html).toContain('42점'); expect(html).toContain('41 / 72');
    expect(html.match(/class="check-card"/g)).toHaveLength(3);
    expect(JSON.stringify(r)).toBe(before);
  });
  test('no false warnings for error with errors=[], optional fail, complete score with incomplete Git', () => {
    const r = fixture(); r.status = 'error'; r.exitCode = 2; r.scoreComplete = false;
    expect(consistencyWarnings(r)).toEqual([]);
    expect(consistencyWarnings(fixture('synthetic/optional-failure.json'))).toEqual([]);
    expect(consistencyWarnings(fixture())).toEqual([]);
  });
  test('all summary counters are cross-checked but score is not recomputed', () => {
    const r = fixture();
    for (const key of Object.keys(r.summary) as (keyof Report['summary'])[]) r.summary[key] += 1;
    r.score = 1; expect(consistencyWarnings(r)).toHaveLength(8);
  });
  test('HTML, commands, URLs and controls stay text in project, checks, Git and diagnostics', () => {
    const r = fixture(); const payload = '<img src="https://invalid.test/leak" onerror="alert(1)">\u202e';
    r.project.name = payload; r.checks[0]!.reason = payload; r.git!.changes[0]!.path = payload;
    r.warnings = [{ code: payload, message: payload, hint: 'javascript:alert(1)' }];
    const html = render(r);
    expect(html).not.toContain('<img'); expect(html).toContain('&lt;img');
    expect(html).toContain('\\u202e'); expect(html).not.toContain('href="javascript:');
  });
  test('large check and Git arrays render only the first 100 entries', () => {
    const r = fixture(); const c = r.checks[0]!; const change = r.git!.changes[0]!;
    r.checks = Array.from({ length: 1000 }, (_, i) => ({ ...c, id: `id${i}`, label: `label${i}` }));
    r.git!.changes = Array.from({ length: 1000 }, (_, i) => ({ ...change, path: `path${i}` }));
    const html = render(r);
    expect(html.match(/class="check-card"/g)).toHaveLength(100);
    expect(html).toContain('label99'); expect(html).not.toContain('label100');
    expect(html).toContain('path99'); expect(html).not.toContain('path100');
  });
  test('diagnostics and violations also paginate, and empty checks are explicit', () => {
    const r = fixture(); r.errors = Array.from({ length: 101 }, (_, i) => ({ code: `diag${i}`, message: '', hint: '' }));
    expect(render(r)).not.toContain('diag100');
    const values = Array.from({ length: 101 }, (_, i) => ({ path: `violation${i}`, pattern: '*' }));
    expect(renderToStaticMarkup(createElement(Violations, { values }))).not.toContain('violation100');
    expect(renderToStaticMarkup(createElement(Checks, { checks: [] }))).toContain('검사 기록 없음');
  });
  test('closed logs stay out of DOM; opened long single lines have a bounded display slice', () => {
    expect(renderToStaticMarkup(createElement(LogPanel, { label: 'stdout', text: 'PRIVATE_LOG' }))).not.toContain('PRIVATE_LOG');
    const text = 'x'.repeat(LOG_PAGE_SIZE) + 'TAIL_NOT_RENDERED';
    const html = renderToStaticMarkup(createElement(LogContent, { text }));
    expect(html).not.toContain('TAIL_NOT_RENDERED'); expect(html).toContain('Viewer 표시 구간');
    expect(html).toContain('검색'); expect(html).not.toContain('CLI가 출력을 잘랐음');
  });
});

describe('bounded literal log search', () => {
  test.each(['.*[a]', '<script>', '한글', 'a\nb', '\u202e', '\u001b'])('literal query %j', async query => {
    expect(await rawSearch('prefix'+query+'suffix', query)).toEqual({ positions: [6], limited: false });
  });
  test('chunk-boundary and overlapping matches are not missed or duplicated', async () => {
    expect(await rawSearch('x'.repeat(65535) + '한글!', '한글!')).toEqual({ positions: [65535], limited: false });
    expect(await rawSearch('aaaa', 'aa')).toEqual({ positions: [0, 1, 2], limited: false });
  });
  test('search is case sensitive and empty/over-limit queries do not execute', async () => {
    expect(await rawSearch('aA', 'a')).toEqual({ positions: [0], limited: false });
    expect(await rawSearch('a', '')).toEqual({ positions: [], limited: false });
    expect(await rawSearch('x'.repeat(300), 'x'.repeat(QUERY_LIMIT + 1))).toEqual({ positions: [], limited: false });
    expect((await rawSearch('x'.repeat(QUERY_LIMIT), 'x'.repeat(QUERY_LIMIT)))?.positions).toEqual([0]);
  });
  test('exact 1000 vs additional matches have distinct search-limit flags', async () => {
    expect((await rawSearch('x'.repeat(SEARCH_LIMIT), 'x'))?.limited).toBe(false);
    const result = await rawSearch('x'.repeat(SEARCH_LIMIT + 1), 'x');
    expect(result?.positions).toHaveLength(SEARCH_LIMIT); expect(result?.limited).toBe(true);
  });
  test('cancellation between chunks returns no stale result and yields control', async () => {
    const abort = new AbortController(); let yields = 0;
    expect(await searchLog('x'.repeat(500000), 'missing', abort.signal, async () => { yields++; abort.abort(); })).toBeNull();
    expect(yields).toBe(1);
    expect(await searchLog('text', 't', abort.signal)).toBeNull();
  });
  test('only dangerous controls are escaped; line/tab layout and text are not HTML', () => {
    expect(visibleLog('<b>\n\t\u001b\u202e')).toBe('<b>\n\t\\u001b\\u202e');
  });
});
