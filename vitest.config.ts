import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts'],
    clearMocks: true,
  },
  resolve: {
    alias: {
      // Mock bun:sqlite for vitest (runs in Node.js, not Bun)
      'bun:sqlite': new URL('./packages/shared/tests/__mocks__/bun-sqlite.ts', import.meta.url).pathname,
    },
  },
});
