import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const csp = "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig({
  base: '/agent-eval-lab/',
  plugins: [react(), {
    name: 'production-csp', apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }]
  }],
  build: { sourcemap: false, modulePreload: false },
  worker: { format: 'es' }
});
