import { useEffect, useState } from 'react';
export type ThemeMode = 'system' | 'light' | 'dark';
export function resolveTheme(mode: ThemeMode, darkSystem: boolean): 'light' | 'dark' {
  return mode === 'system' ? (darkSystem ? 'dark' : 'light') : mode;
}
export function ThemeControl() {
  const [mode, setMode] = useState<ThemeMode>('system');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = resolveTheme(mode, media.matches); };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);
  return <div className="theme-control">
    <label htmlFor="theme-mode">화면 테마</label>
    <select id="theme-mode" value={mode} onChange={event => setMode(event.target.value as ThemeMode)}>
      <option value="system">System · 시스템</option><option value="light">Light · 밝게</option><option value="dark">Dark · 어둡게</option>
    </select>
  </div>;
}
