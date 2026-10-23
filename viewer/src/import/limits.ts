// Viewer resource policy, NOT extra JSON Schema constraints.
export const LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, depth: 64, nodes: 200000, checks: 10000, changes: 50000, workerMs: 5000 });
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function withinStructureLimits(value: unknown): boolean {
  if (isRecord(value)) {
    if (Array.isArray(value.checks) && value.checks.length > LIMITS.checks) return false;
    if (isRecord(value.git) && Array.isArray(value.git.changes) && value.git.changes.length > LIMITS.changes) return false;
  }
  // Iterator frames bound auxiliary memory by depth, not object width.
  const stack: { values: IterableIterator<unknown>; depth: number }[] = [{ values: [value].values(), depth: 0 }];
  let nodes = 0;
  function* children(object: Record<string, unknown>): IterableIterator<unknown> {
    for (const key in object) if (Object.hasOwn(object, key)) yield object[key];
  }
  while (stack.length) {
    const frame = stack[stack.length - 1]!;
    const next = frame.values.next();
    if (next.done) { stack.pop(); continue; }
    if (++nodes > LIMITS.nodes || frame.depth > LIMITS.depth) return false;
    const item: unknown = next.value;
    if (Array.isArray(item)) stack.push({ values: item.values(), depth: frame.depth + 1 });
    else if (isRecord(item)) stack.push({ values: children(item), depth: frame.depth + 1 });
  }
  return true;
}
