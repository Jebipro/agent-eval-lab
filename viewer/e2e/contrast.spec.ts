import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test('measured text/status/control contrast: ' + theme, async ({ page }, info) => {
    await page.goto('./'); await page.getByLabel('화면 테마').selectOption(theme);
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(['text','muted','bg','surface','surface-soft','accent','accent-soft','on-accent',
        'pass-text','pass-bg','fail-text','fail-bg','error-text','error-bg','neutral-text','neutral-bg',
        'control-line','focus','code-bg','mark-text','mark-bg'].map(name => [name, style.getPropertyValue('--'+name).trim()]));
    });
    function luminance(hex: string): number {
      // Production CSS may shorten #ffffff to #fff.
      expect(hex).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex.length === 4) hex = '#' + [...hex.slice(1)].map(c => c + c).join('');
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i+2), 16) / 255)
        .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
    }
    const pairs: [string, string, number][] = [
      ...['bg','surface','surface-soft','code-bg'].map(bg => ['text',bg,4.5] as [string,string,number]),
      ...['bg','surface','surface-soft'].map(bg => ['muted',bg,4.5] as [string,string,number]),
      ['accent','accent-soft',4.5],['on-accent','accent',4.5],['mark-text','mark-bg',4.5],
      ...['pass','fail','error','neutral'].map(s => [s+'-text',s+'-bg',4.5] as [string,string,number]),
      ...['bg','surface','surface-soft'].map(bg => ['focus',bg,3] as [string,string,number]),
      ['control-line','surface',3]
    ];
    const results = pairs.map(([fg,bg,minimum]) => {
      const a = luminance(tokens[fg]!), b = luminance(tokens[bg]!);
      const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      expect(ratio, fg+'/'+bg).toBeGreaterThanOrEqual(minimum);
      return { fg, bg, ratio, minimum };
    });
    await info.attach('contrast-'+theme, { body: JSON.stringify(results), contentType: 'application/json' });
  });
}
