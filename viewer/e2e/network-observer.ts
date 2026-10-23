import { expect, type Page, type Request } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { exactLocalReads, requestKind } from './network-policy';

export function observeImportNetwork(page: Page) {
  const requests: Request[] = [];
  page.on('request', request => requests.push(request));
  return async (engine: string, payload: Buffer, sentinel: string) => {
    const base = 'http://127.0.0.1:4173/agent-eval-lab/';
    const assets = new Map([[base, 'document'], [base + 'favicon.svg', 'other']]);
    for (const name of readdirSync('dist/assets')) {
      if (/^index-[\w-]+\.js$/.test(name)) assets.set(base + 'assets/' + name, 'script');
      if (/^index-[\w-]+\.css$/.test(name)) assets.set(base + 'assets/' + name, 'stylesheet');
      if (/^import\.worker-[\w-]+\.js$/.test(name)) assets.set(base + 'assets/' + name, 'worker');
    }
    const blobs: Request[] = [];
    for (const request of requests) {
      const observed = { url: request.url(), method: request.method(), body: request.postData(), kind: request.resourceType() };
      expect(JSON.stringify({ ...observed, headers: await request.allHeaders() })).not.toContain(sentinel);
      const kind = requestKind(observed, engine, assets);
      expect(kind, JSON.stringify(observed)).not.toBe('reject');
      if (kind === 'local-blob') blobs.push(request);
    }
    expect(blobs).toHaveLength(engine === 'webkit' ? 1 : 0);
    const bodies: Buffer[] = [];
    for (const blob of blobs) {
      const response = await blob.response();
      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);
      // WebKit exposes Blob.arrayBuffer's internal read as xhr. Verify the exact
      // response, not an arbitrary blob URL, and never exempt request contents.
      bodies.push(await response!.body());
    }
    expect(exactLocalReads(engine, bodies, payload)).toBe(true);
  };
}
