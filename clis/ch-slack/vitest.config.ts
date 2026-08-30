import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20_000,
    environment: 'node',
    include: ['**/*.test.ts{,x}'],
    exclude: [
      '**/*.ui.test.ts{,x}',
      '**/*.e2e.test.ts{,x}',
      '**/node_modules/**',
    ],
    globals: true,
    watch: false,
    restoreMocks: true,
    passWithNoTests: false,
  },
});
