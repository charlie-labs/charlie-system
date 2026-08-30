#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Verifies that the generated GraphQL SDK (`src/generated/**`) is in sync
 * with the current queries using GraphQL Codegen’s built‑in `--check` flag.
 *
 * Usage: bun run scripts/verify-codegen.ts
 */

/**
 * Runs a shell command synchronously.
 *
 * • When `stdio` is `"pipe"`, stdout is captured and returned as a UTF‑8
 *   string.
 * • When `stdio` is `"inherit"`, output is streamed directly to the current
 *   process and `undefined` is returned.
 *
 * An `Error` is thrown if the command exits with a non‑zero code, allowing
 * callers to rely on try/catch for error handling.
 */
const run = (
  cmd: string,
  stdio: 'inherit' | 'pipe' = 'pipe'
): string | undefined => {
  const result = Bun.spawnSync(['bash', '-c', cmd], {
    stdin: 'inherit',
    stdout: stdio === 'inherit' ? 'inherit' : 'pipe',
    // Forward stderr so errors are shown immediately; nothing is captured.
    stderr: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd} (exit code ${result.exitCode})`);
  }

  if (stdio === 'pipe') {
    const stdoutBuffer = result.stdout as Uint8Array | null;
    return stdoutBuffer ? new TextDecoder().decode(stdoutBuffer) : '';
  }

  return undefined;
};

run('bun run codegen -- --check', 'inherit');
console.log('✅  GraphQL codegen output is up‑to‑date.');
