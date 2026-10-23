export type InputError = 'MultipleFiles' | 'UnsupportedDrop';
export type FileDecision = { kind: 'none' } | { kind: 'file'; file: File } | { kind: 'error'; code: InputError };

// An empty native file selection means the user dismissed the picker: keep current state.
export function selectedFiles(files: readonly File[]): FileDecision {
  if (!files.length) return { kind: 'none' };
  if (files.length !== 1) return { kind: 'error', code: 'MultipleFiles' };
  return { kind: 'file', file: files[0]! };
}

interface DropItem {
  kind: string;
  webkitGetAsEntry?: () => { isDirectory: boolean } | null;
}
export function droppedFiles(transfer: { files: ArrayLike<File>; items: ArrayLike<DropItem> }): FileDecision {
  try {
    const items = Array.from(transfer.items);
    if (items.some(item => item.kind !== 'file' || item.webkitGetAsEntry?.()?.isDirectory)) {
      return { kind: 'error', code: 'UnsupportedDrop' };
    }
    const files = Array.from(transfer.files);
    if (!files.length || (items.length > 0 && items.length !== files.length)) {
      return { kind: 'error', code: 'UnsupportedDrop' };
    }
    return selectedFiles(files);
  } catch {
    return { kind: 'error', code: 'UnsupportedDrop' };
  }
}
