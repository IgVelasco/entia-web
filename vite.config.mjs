import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the Nix site and the embedded offline demo.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, 'index.html'),
        demo: resolve(import.meta.dirname, 'demo/index.html'),
      },
    },
  },
});
