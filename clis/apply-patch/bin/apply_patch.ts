#!/usr/bin/env bun
/* eslint-disable no-console */

import { Buffer } from 'node:buffer';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { ApplyPatchError, applyPatchWithReport } from '../src/index.js';

/** Print short usage/help text. */
function showHelp(): void {
  console.log(`apply_patch [OPTIONS] [<diff>]

Apply a V4A patch to the current working directory.

Options:
  -h, --help     Show this help then exit.
  -v, --version  Print the package version then exit.
  --spec         Print the full V4A diff specification.

Examples:
# Pass patch as a single argument
apply_patch <<'PATCH'
*** Begin Patch
*** Update File: packages/ai-agents/src/agents/edit-code-simple.ts
@@
- foo
+ bar
*** End Patch
PATCH
`);
}

/**
 * Read the package version string from the repository's package.json.
 *
 * Resolves the path relative to this file so it works from a checkout
 * or an installed package. Uses Bun fast-path when available, otherwise
 * falls back to Node's fs/promises.
 *
 * @returns The version string (e.g., "0.0.3").
 * @throws If package.json cannot be read or lacks a valid string version.
 */
async function readPackageVersion(): Promise<string> {
  const pkgPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../package.json'
  );
  const raw = await Bun.file(pkgPath).text();
  const parsed = JSON.parse(raw);
  const version =
    typeof parsed === 'object' && parsed !== null && 'version' in parsed
      ? parsed.version
      : 'unknown';
  return version;
}

void (async () => {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      spec: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false, // Preserve previous permissive behaviour for unknown flags
  });

  // --help -------------------------------------------------------------------
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // -v, --version ------------------------------------------------------------
  if (values.version) {
    try {
      const version = await readPackageVersion();
      console.log(version);
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to read version: ${msg}`);
      process.exit(1);
    }
  }

  // --spec -------------------------------------------------------------------
  if (values.spec) {
    const specPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../docs/v4a-diff-spec.md'
    );
    try {
      const text = await Bun.file(specPath).text();
      console.log(text.trimEnd());
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `Failed to read bundled V4A spec file: ${msg} (path: ${specPath}).`
      );
      process.exit(1);
    }
  }

  // Determine diff -----------------------------------------------------------
  let diff = '';
  if (!process.stdin.isTTY) {
    diff = (await Bun.stdin.text()).trimEnd();
  }

  if (!diff.trim() && positionals.length > 0) {
    diff = positionals.join(' ');
  }

  if (Buffer.byteLength(diff.trim()) === 0) {
    console.error(
      'No diff provided. Supply a patch via stdin or as an argument (see `apply_patch --help`).'
    );
    process.exit(1);
  }

  try {
    const { porcelain } = await applyPatchWithReport(diff);
    if (porcelain && porcelain.trim()) {
      // Print report of patch-generated changes.
      console.log(`Patch applied successfully:\n${porcelain.trimEnd()}`);
    } else {
      console.log('Patch applied successfully');
    }
    process.exit(0);
  } catch (err) {
    let errorMessage: string;
    if (ApplyPatchError.isInstance(err)) {
      errorMessage = err.message;
    } else {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    console.error(`Failed to apply patch: ${errorMessage}`);
    process.exit(1);
  }
})();
