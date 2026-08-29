#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Verification script: ensure every *concrete* command file under
 * `src/commands/` declares a `static examples = [...]` array.
 *
 * A file is considered a *pure re-export wrapper* (and therefore skipped)
 * when its entire trimmed contents match the pattern:
 *   export { default } from './something.js';
 * (semicolon optional)
 *
 * Exit code:
 *   0 – all commands have examples
 *   1 – one or more commands are missing examples (file list printed)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const COMMANDS_DIR = path.join(ROOT, 'src', 'cli', 'commands');

/** Regex to detect the `static examples = [` declaration. */
const EXAMPLES_REGEX = /static\s+examples\s*=\s*\[/; // simplistic but sufficient

/** Regex to detect a pure re-export wrapper file. */
const REEXPORT_REGEX = /^export\s+\{\s*default\s*\}\s+from\s+['"].+['"];?$/;

async function main(): Promise<void> {
  const all = await collectTsFiles(COMMANDS_DIR);
  const missing: string[] = [];

  for (const file of all) {
    const raw = await fs.readFile(file, 'utf8');
    const trimmed = raw.trim();

    // Skip generated or declaration files just in case (none expected here)
    if (file.endsWith('.d.ts')) continue;

    // Skip pure re-export wrappers
    if (REEXPORT_REGEX.test(trimmed)) continue;

    if (!EXAMPLES_REGEX.test(raw)) {
      missing.push(path.relative(ROOT, file));
    }
  }

  if (missing.length) {
    console.error(
      '\nMissing `static examples` declarations in the following command files:'
    );
    for (const f of missing) {
      console.error('  - ' + f);
    }
    console.error(
      '\nAdd a non-empty `static examples: string[]` to each of the above classes.'
    );
    process.exitCode = 1;
    return;
  }

  // Optional success message (kept terse to avoid noisy CI logs)
  console.log('verify-examples: all command files include `static examples`.');
}

/** Recursively collect .ts source files under a directory. */
async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Ignore colocated test directories
      if (entry.name === '__tests__') continue;
      files.push(...(await collectTsFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Ignore test files even if they were not inside __tests__ (defensive)
      if (entry.name.endsWith('.test.ts')) continue;
      files.push(full);
    }
  }
  return files;
}

// Execute (do not await main so unhandled rejections surface naturally)
main().catch((err) => {
  console.error('verify-examples: unexpected error');
  console.error(
    err instanceof Error ? (err.stack ?? err.message) : String(err)
  );
  process.exitCode = 1;
});
