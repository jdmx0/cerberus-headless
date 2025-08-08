import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});



