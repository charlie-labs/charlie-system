# test-harness-cli fixture

This directory hosts a minimal oclif CLI used by `__tests__/help-flags-caching.test.ts`.

Key points:

- Imports route through `src-under-test.ts`, which re-exports the helpers from the
  repository's `src/index.ts` so we can exercise the public API without staging a stubbed
  `node_modules` tree.
- Everything stays Bun/ESM-friendly and relies on the repository's runtime dependencies.

Please keep this directory lightweight and avoid adding unrelated dependencies; it
should remain focused on exercising the help/flags path end-to-end.
