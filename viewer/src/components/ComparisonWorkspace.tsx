import { useEffect, useReducer, useRef, useState } from 'react';
import type { ReadonlyReport } from '../report/types';
import { ImportController } from '../import/controller';
import { importReducer, recovery } from '../app/import-state';
import { selectedFiles } from '../import/file-input';
import { importError } from '../import/errors';
import { displayText } from '../report/view-model';
import { candidates, candidateById, exampleKind, loadExampleText } from '../examples/catalog';
import { Dashboard } from './Dashboard';
import { ComparisonView } from './ComparisonView';

/** Mounted per A import generation, not run ID. Unmount cancels and releases B. */
export function ComparisonWorkspace({ report }: { report: ReadonlyReport }) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState('');
  const [state, dispatch] = useReducer(importReducer, { kind: 'empty', id: 0 });
  const controller = useRef<ImportController | null>(null);
  if (!controller.current) controller.current = new ImportController();
  const generation = useRef(0);
  const load = useRef<AbortController | null>(null);
  const add = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => () => { ++generation.current; controller.current?.cancel(); load.current?.abort(); }, []);
  useEffect(() => { if (active) input.current?.focus(); }, [active]);
  useEffect(() => {
    if (state.kind === 'ready' || state.kind === 'error') status.current?.focus();
  }, [state]);
  function stop(close: boolean) {
    const id = ++generation.current;
    controller.current?.cancel(); load.current?.abort();
    dispatch({ type: close ? 'close' : 'cancel', id });
    if (close) { setActive(false); setSelected(''); add.current?.focus(); }
    else input.current?.focus();
  }
  async function validate(file: File, id: number) {
    try {
      const result = await controller.current!.import(file);
      if (id === generation.current) dispatch({ type: 'settled', id, result });
    } catch {
      if (id === generation.current) {
        controller.current?.cancel();
        dispatch({ type: 'settled', id, result: { ok: false, error: importError('WorkerError') } });
      }
    }
  }
  function choose(files: File[]) {
    const decision = selectedFiles(files);
    if (decision.kind === 'none') return; // Native chooser cancellation preserves B.
    const id = ++generation.current;
    load.current?.abort(); controller.current?.cancel(); setSelected('');
    if (decision.kind === 'error') dispatch({ type: 'reject', id, code: decision.code });
    else {
      dispatch({ type: 'start', id, filename: displayText(decision.file.name) });
      void validate(decision.file, id);
    }
  }
  async function example() {
    const candidate = candidateById(selected);
    if (!candidate) return;
    const id = ++generation.current;
    controller.current?.cancel(); load.current?.abort();
    const abort = new AbortController(); load.current = abort;
    dispatch({ type: 'start', id, filename: candidate.title + ' · ' + exampleKind(candidate.kind) });
    try {
      const text = await loadExampleText(candidate.id, abort.signal);
      if (generation.current !== id || abort.signal.aborted) return;
      await validate(new File([text], candidate.id + '.json', { type: 'application/json' }), id);
    } catch {
      if (generation.current === id) dispatch({ type: 'settled', id, result: { ok: false, error: importError('ReadError') } });
    } finally { if (load.current === abort) load.current = null; }
  }
  return <>
    <div className="actions"><button ref={add} type="button" aria-expanded={active} aria-controls="comparison-import" onClick={() => { setActive(true); if (active) input.current?.focus(); }}>비교할 보고서 추가</button></div>
    {active && <section id="comparison-import" className="panel" aria-labelledby="comparison-import-title">
      <h2 id="comparison-import-title">B · 이후(After) 보고서 가져오기</h2>
      <p>A · 이전(Before)은 먼저 연 보고서입니다. 위의 파일 선택·예제 열기로 A를 교체하면 B도 정리됩니다.</p>
      <label htmlFor="comparison-file">B 로컬 JSON 파일 선택</label>
      <input ref={input} id="comparison-file" type="file" accept=".json,application/json" onChange={e => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ''; choose(files); }} />
      <p className="hint">최대 10 MiB. 새 B 검증을 시작하면 이전 B는 제거됩니다. 파일 선택 창 취소는 기존 결과를 유지합니다. 검증 중 취소는 B만 정리합니다.</p>
      <label htmlFor="comparison-example">B 체험 예제 선택</label>
      <select id="comparison-example" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">예제를 선택하세요</option>
        {candidates.map(c => <option key={c.id} value={c.id}>{c.title} · {exampleKind(c.kind)}</option>)}
      </select>
      <p className="hint">공개 승인된 예제만 사용합니다. 합성 예제는 실제 실행 기록이 아닙니다.</p>
      <div className="actions">
        <button type="button" disabled={!selected} onClick={() => { void example(); }}>B 선택한 예제 열기</button>
        {state.kind === 'loading' && <button type="button" onClick={() => stop(false)}>B 검증 취소</button>}
        <button type="button" onClick={() => stop(true)}>비교 종료 · B 닫기</button>
      </div>
      <div ref={status} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
        {'filename' in state && state.filename && <p>B: <bdi>{state.filename}</bdi></p>}
        {state.kind === 'loading' && <><p>B 검증 중… A는 유지됩니다.</p><progress aria-label="B 보고서 검증 중" /></>}
        {state.kind === 'ready' && <p>B 계약 검증 성공. A/B 비교 결과를 표시합니다.</p>}
        {state.kind === 'cancelled' && <p>B 검증을 취소했습니다. A는 유지됩니다.</p>}
        {state.kind === 'error' && <><p>{state.error.code}: {state.error.message}</p><p>{recovery[state.error.code]}</p><p>A는 유지되며 이전 B와 비교 결과는 제거되었습니다.</p></>}
      </div>
    </section>}
    {state.kind === 'ready' ? <ComparisonView key={state.id} before={report} after={state.report} /> : <Dashboard report={report} />}
  </>;
}
