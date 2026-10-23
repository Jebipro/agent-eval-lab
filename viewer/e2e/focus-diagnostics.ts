import type { Page } from '@playwright/test';

// Test-only bounded metadata: never record text, values, URLs or arbitrary attributes.
export async function installFocusDiagnostics(page: Page) {
  await page.addInitScript(() => {
    const records: unknown[] = [];
    const ids = new WeakMap<Element, number>();
    let next = 1;
    let dropped = 0;
    const describe = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      if (!ids.has(target)) ids.set(target, next++);
      const tag = target.tagName.toLowerCase();
      const role = target.getAttribute('role');
      return {
        node: ids.get(target),
        tag: ['html', 'body', 'input', 'textarea', 'button', 'select', 'option', 'a', 'summary', 'details', 'pre', 'section', 'div'].includes(tag) ? tag : 'other',
        id: ['report-file', 'import-panel', 'overview', 'checks', 'git-changes', 'diagnostics'].includes(target.id) ? target.id : target.id ? '[redacted]' : '',
        role: role && ['button', 'status', 'region', 'link', 'textbox'].includes(role) ? role : role ? '[redacted]' : null,
      };
    };
    const record = (kind: string, key: string | null = null, target: EventTarget | null = null) => {
      if (records.length >= 1500) { dropped++; return; }
      // This selector identifies application-owned controls, never report strings.
      const close = document.querySelector<HTMLButtonElement>('#import-panel .actions button:last-child');
      records.push({ sequence: records.length, kind, key, hasFocus: document.hasFocus(),
        active: describe(document.activeElement), target: describe(target),
        close: close ? { ...describe(close), exists: true, disabled: close.disabled,
          hidden: close.hidden || !!close.closest('[hidden],[inert]') || getComputedStyle(close).display === 'none' || getComputedStyle(close).visibility === 'hidden' || close.getClientRects().length === 0,
          tabIndex: close.tabIndex } : { exists: false } });
    };
    for (const kind of ['focusin', 'focusout']) document.addEventListener(kind, event => record(kind, null, event.target), true);
    for (const kind of ['keydown', 'keyup']) document.addEventListener(kind, event => {
      if (event instanceof KeyboardEvent && ['Tab', 'Enter', ' ', 'Home', 'ArrowDown'].includes(event.key)) {
        record(kind, event.key === 'Tab' && event.shiftKey ? 'Shift+Tab' : event.key === ' ' ? 'Space' : event.key, event.target);
      }
    }, true);
    window.addEventListener('blur', () => record('window-blur'));
    window.addEventListener('focus', () => record('window-focus'));
    Object.assign(window, { __aelFocusDiagnostic: { record, read: () => ({ records, dropped }) } });
  });
}

type DiagnosticWindow = Window & { __aelFocusDiagnostic?: {
  record: (kind: string, key?: string) => void;
  read: () => unknown;
} };
export async function recordFocusStep(page: Page, phase: 'before' | 'after', key: 'Tab' | 'Shift+Tab') {
  await page.evaluate(({ phase, key }) => (window as DiagnosticWindow).__aelFocusDiagnostic?.record(phase, key), { phase, key });
}
export async function readFocusDiagnostics(page: Page) {
  return page.evaluate(() => (window as DiagnosticWindow).__aelFocusDiagnostic?.read() ?? { unavailable: true });
}
