import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
