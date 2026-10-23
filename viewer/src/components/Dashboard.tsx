import { Component, type ReactNode } from 'react';
import type { ReadonlyReport } from '../report/types';
import { Overview } from './Overview';
import { Checks } from './Checks';
import { GitChanges } from './GitChanges';
import { Diagnostics } from './Diagnostics';

export class ResultBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* No report, exception text or stack is logged. */ }
  render() {
    return this.state.failed ? <p role="alert">평가 화면을 표시할 수 없습니다. 닫거나 다른 파일을 선택하세요.</p> : this.props.children;
  }
}
export function Dashboard({ report }: { report: ReadonlyReport }) {
  return <div className="dashboard">
    <nav className="section-links" aria-label="평가 결과 탐색">
      <a href="#overview" tabIndex={0}>평가 개요</a><a href="#checks" tabIndex={0}>검사 결과</a><a href="#git-changes" tabIndex={0}>Git 변경</a><a href="#diagnostics" tabIndex={0}>평가 진단</a>
    </nav>
    <Overview report={report} />
    <Checks checks={report.checks} />
    <GitChanges report={report} />
    <Diagnostics report={report} />
  </div>;
}
