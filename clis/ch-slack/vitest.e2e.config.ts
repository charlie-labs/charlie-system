import { defineConfig } from 'vitest/config';

// Import the runtime-compatible base config; use `.js` so Node/Vitest resolution
// picks up the compiled config at runtime under NodeNext ESM settings.
import base from './vitest.config.js';

// E2E-specific Vitest config:
// - Only include **/*.e2e.test.ts
// - Longer timeout for network + Slack backoff behavior
// - Run files sequentially (no file parallelism)
// - Do not fail when the suite is gated off (passWithNoTests: true)
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['**/*.e2e.test.ts{,x}'],
    exclude: ['**/node_modules/**'],
    // eslint-disable-next-line no-process-env
    testTimeout: Number(process.env['E2E_TEST_TIMEOUT'] ?? 120_000),
    fileParallelism: false,
    // Ensure skipped/gated runs don't fail CI
    passWithNoTests: true,
  },
});
