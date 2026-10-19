import type { Report } from './types.js';
export function serialize(report: Report): string { return JSON.stringify(report, null, 2) + '\n'; }
