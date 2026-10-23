export const LOG_PAGE_SIZE = 32_768;
export const LIST_PAGE_SIZE = 100;
export const SEARCH_LIMIT = 1_000;
export const QUERY_LIMIT = 256;
const SEARCH_CHUNK = 65_536;

export interface SearchResult { positions: number[]; limited: boolean }

/** Literal, case-sensitive, overlapping matches; bounded work and storage. No regex from input. */
export async function searchLog(text: string, query: string, signal: AbortSignal,
  yieldTask: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0))): Promise<SearchResult | null> {
  if (signal.aborted) return null;
  if (!query || query.length > QUERY_LIMIT) return { positions: [], limited: false };
  const positions: number[] = [];
  for (let start = 0; start < text.length; start += SEARCH_CHUNK) {
    if (signal.aborted) return null;
    const end = Math.min(text.length, start + SEARCH_CHUNK);
    const chunk = text.slice(start, end + query.length - 1);
    let cursor = 0;
    while (cursor < end - start) {
      const found = chunk.indexOf(query, cursor);
      if (found < 0 || start + found >= end) break;
      if (positions.length === SEARCH_LIMIT) return { positions, limited: true };
      positions.push(start + found);
      cursor = found + 1;
    }
    await yieldTask();
  }
  return signal.aborted ? null : { positions, limited: false };
}

/** Keep layout whitespace; expose terminal/bidi controls without interpreting them. */
export function visibleLog(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
