import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@hk/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
      '@hk/providers': fileURLToPath(new URL('./packages/providers/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
