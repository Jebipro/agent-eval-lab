import { useEffect, useReducer, useRef, useState } from 'react';
import { ImportController } from '../import/controller';
import { importError } from '../import/errors';
import { droppedFiles, selectedFiles, type FileDecision } from '../import/file-input';
import { acceptanceView, displayText } from '../report/view-model';
import { importReducer, recovery } from './import-state';
import { ResultBoundary } from '../components/Dashboard';
import { ComparisonWorkspace } from '../components/ComparisonWorkspace';
import { ThemeControl } from '../components/ThemeControl';
import { ExamplePicker } from '../components/ExamplePicker';
import { candidateById, exampleKind, loadExampleText } from '../examples/catalog';

export function App() {
  const controller = useRef<ImportController | null>(null);
  if (!controller.current) controller.current = new ImportController();
  const generation = useRef(0);
  const exampleLoad = useRef<AbortController | null>(null);
  const [selectedExample, setSelectedExample] = useState('');
  const [origin, setOrigin] = useState<{ id: number; label: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(importReducer, { kind: 'empty', id: 0 });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    // Prevent accidental browser navigation when a file/URL misses the drop area.
    const prevent = (event: DragEvent) => { event.preventDefault(); };
    const outside = (event: DragEvent) => {
      event.preventDefault(); setDragging(false); controller.current?.cancel(); exampleLoad.current?.abort(); setOrigin(null);
      dispatch({ type: 'reject', id: ++generation.current, code: 'UnsupportedDrop' });
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', outside);
    return () => {
      window.removeEventListener('dragover', prevent); window.removeEventListener('drop', outside);
      ++generation.current; controller.current?.cancel(); exampleLoad.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (state.kind === 'ready' || state.kind === 'error') status.current?.focus();
  }, [state]);
  function clear(type: 'close' | 'cancel') {
    ++generation.current; controller.current?.cancel(); exampleLoad.current?.abort(); setDragging(false); setOrigin(null); setSelectedExample('');
    dispatch({ type, id: generation.current });
    if (input.current) { input.current.value = ''; input.current.focus(); }
  }
  function choose(decision: FileDecision) {
    if (decision.kind === 'none') return;
    if (decision.kind === 'error') {
      controller.current?.cancel(); exampleLoad.current?.abort(); setOrigin(null);
      dispatch({ type: 'reject', id: ++generation.current, code: decision.code });
    } else void open(decision.file);
  }
  async function open(file: File) {
    const id = ++generation.current;
    exampleLoad.current?.abort(); setOrigin(null);
    dispatch({ type: 'start', id, filename: displayText(file.name) });
    await validate(file, id);
  }
  async function validate(file: File, id: number) {
    try {
      const result = await controller.current!.import(file);
      dispatch({ type: 'settled', id, result });
    } catch {
      if (generation.current === id) controller.current?.cancel();
      dispatch({ type: 'settled', id, result: { ok: false, error: importError('WorkerError') } });
    }
  }
  async function openExample(candidateId: string) {
    const candidate = candidateById(candidateId);
    if (!candidate) return;
    const id = ++generation.current;
    controller.current?.cancel(); exampleLoad.current?.abort();
    const abort = new AbortController(); exampleLoad.current = abort;
    setOrigin({ id, label: exampleKind(candidate.kind) + ' · 공개 승인 예제' });
    dispatch({ type: 'start', id, filename: candidate.title });
    try {
      const text = await loadExampleText(candidate.id, abort.signal);
      if (id !== generation.current || abort.signal.aborted) return;
      await validate(new File([text], candidate.id + '.json', { type: 'application/json' }), id);
    } catch {
      if (id === generation.current) dispatch({ type: 'settled', id, result: { ok: false, error: importError('ReadError') } });
    } finally {
      if (exampleLoad.current === abort) exampleLoad.current = null;
    }
  }
  const view = state.kind === 'ready' ? acceptanceView(state.report) : null;
  return <>
    <a className="skip-link" href="#import-panel" tabIndex={0}>파일 열기로 이동</a>
    <main>
    <header className="app-header"><div className="brand"><span className="brand-symbol" aria-hidden="true">A / E</span><div>Agent Eval Lab<small>REPORT VIEWER</small></div></div><ThemeControl /></header>
    <div className="hero"><p className="eyebrow">평가 결과를, 명확하게.</p><h1>JSON 보고서 열기</h1>
    <p>점수부터 실패한 검사까지. 기록된 결과를 한곳에서 확인하세요.</p>
    <p id="privacy" className="privacy-note">파일은 브라우저 안에서만 처리하며 저장하거나 전송하지 않습니다.</p></div>
    <div className="import-grid">
    <section id="import-panel" tabIndex={-1} aria-label="보고서 가져오기" className={dragging ? 'drop-area dragging' : 'drop-area'}
      onDragEnter={event => { event.preventDefault(); setDragging(true); }}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={event => {
        event.preventDefault(); event.stopPropagation(); setDragging(false); choose(droppedFiles(event.dataTransfer));
      }}>
      <p className="eyebrow">LOCAL REPORT</p><h2>로컬 파일 하나 선택</h2>
      <p id="file-help">이 영역에 JSON 파일 하나를 놓거나 아래 파일 선택을 사용하세요. 최대 10 MiB, schemaVersion 1을 지원합니다. 폴더·URL·여러 파일은 지원하지 않습니다.</p>
      <label htmlFor="report-file">로컬 JSON 파일 선택</label>
      <input ref={input} id="report-file" type="file" accept=".json,application/json" aria-describedby="file-help privacy" onChange={event => {
        const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; choose(selectedFiles(files));
      }} />
      <p className="hint">확장자와 MIME은 안내용이며 실제 내용으로 검증합니다. 파일 선택 창을 취소하면 현재 결과를 유지합니다.</p>
    <div className="actions">
      {state.kind !== 'empty' && <button type="button" onClick={() => input.current?.click()}>다른 파일로 교체하기</button>}
      {state.kind === 'loading' && <button type="button" onClick={() => clear('cancel')}>검증 취소</button>}
      <button type="button" onClick={() => clear('close')}>닫기</button>
    </div>
    <div ref={status} className={'import-status import-' + state.kind} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true">
      {'filename' in state && state.filename !== null && <p>{origin?.id === state.id ? origin.label : '로컬 파일'}: <bdi>{state.filename}</bdi></p>}
      {state.kind === 'loading' && <><p>검증 중… 새 파일을 선택하거나 취소할 수 있습니다.</p><progress aria-label="보고서 검증 중" /></>}
      {view && <p>계약 검증 성공: {view.projectName} (schemaVersion {view.schemaVersion})</p>}
      {state.kind === 'cancelled' && <p>검증을 취소했습니다. 파일을 다시 선택할 수 있습니다.</p>}
      {state.kind === 'error' && <>
        <p>{state.error.code}: {state.error.message}</p>
        <p>{recovery[state.error.code]}</p>
        {state.error.issues.length > 0 && <ul aria-label="스키마 오류 위치">{state.error.issues.map((issue, index) =>
          <li key={index}>{displayText(issue.path || '/')} — {displayText(issue.keyword)}</li>)}</ul>}
      </>}
    </div>
    </section>
    <ExamplePicker selected={selectedExample} onSelect={setSelectedExample} onOpen={id => { void openExample(id); }} />
    </div>
    {state.kind === 'empty' && <div className="empty-state"><h2>아직 열린 보고서가 없습니다</h2><p>JSON 파일을 선택하거나 체험 예제를 열어 시작하세요.</p><p className="hint">보고서를 닫거나 페이지를 새로고침하면 화면의 데이터가 해제됩니다.</p></div>}
    <div className="reading-note"><p className="hint">파일명·프로젝트명·오류 위치의 긴 문자열은 줄이고 제어 문자는 이스케이프로 표시합니다. 원본 JSON은 수정하지 않습니다.</p>
    <p className="hint">계약 검증 성공은 평가 PASS를 뜻하지 않습니다. 실패·오류·취소 결과도 유효한 보고서로 열 수 있습니다. 평가 내용의 진실성은 검증하지 않습니다.</p></div>
    {state.kind === 'ready' && <ResultBoundary key={state.id}><ComparisonWorkspace report={state.report} /></ResultBoundary>}
    </main>
  </>;
}
