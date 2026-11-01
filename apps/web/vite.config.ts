import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
  },
  // `@karnameh/shared` is a linked workspace package emitted as CommonJS. Pre-bundle
  // it in dev (esbuild -> ESM) so the browser can import its runtime helpers.
  optimizeDeps: {
    include: ['@karnameh/shared'],
  },
  build: {
    commonjsOptions: { include: [/node_modules/, /packages[\\/]shared/] },
  },
});
