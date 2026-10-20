
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden'
        ? 'hidden'
        : false,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        dashboard: resolve(root, 'dashboard.html'),
      },
      maxParallelFileOps: 128,
    },
  },
});
