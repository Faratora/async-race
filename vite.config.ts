import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  base: '/faratora-JSSB2026Q2/async-race/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.join(import.meta.dirname, 'index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
});