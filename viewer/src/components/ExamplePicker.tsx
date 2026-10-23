import { candidates, candidateById, exampleKind } from '../examples/catalog';
export function ExamplePicker({ selected, onSelect, onOpen }: {
  selected: string; onSelect: (id: string) => void; onOpen: (id: string) => void;
}) {
  const candidate = candidateById(selected);
  return <section className="example-panel" aria-labelledby="examples-title">
    <p className="eyebrow">EXAMPLES</p><h2 id="examples-title">보고서로 먼저 둘러보기</h2>
    <p>공식 실행 기록과 합성 예제로 평가 화면을 살펴보세요.</p>
    <label htmlFor="example-choice">체험 예제 선택</label>
    <select id="example-choice" value={selected} onChange={event => onSelect(event.target.value)} aria-describedby="example-policy">
      <option value="">예제를 선택하세요</option>
      {candidates.map(item => <option key={item.id} value={item.id}>{item.title} · {exampleKind(item.kind)}</option>)}
    </select>
    {candidate && <div className="example-description">
      <p><span className="provenance">{exampleKind(candidate.kind)}</span></p>
      <p>{candidate.description}</p>
      <p className="hint">출처: <code>{candidate.publishedSource ?? candidate.source}</code></p>
    </div>}
    <button type="button" onClick={() => { if (candidate) onOpen(candidate.id); }} disabled={!candidate}>선택한 예제 열기</button>
    <p id="example-policy" className="hint">공개 승인된 체험 예제 7개. 합성 예제는 실제 실행 기록이 아닙니다. mini-lang 실전 자료는 포함하지 않습니다.</p>
    <p className="hint">불러오기에 실패하면 다시 열거나 페이지를 새로고침하세요. 로컬 파일 선택도 사용할 수 있습니다.</p>
  </section>;
}
