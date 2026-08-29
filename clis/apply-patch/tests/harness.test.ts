import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import { applyPatch, ApplyPatchError } from '../src/index.js';
import { createMemoryFs } from '../src/runtime/fs/memory.js';
import { withNL } from './helpers.js';

type FixtureRaw = {
  description?: string;
  expect?: 'success' | 'error';
  strict?: boolean;
  before?: Record<string, string>;
  patch: string;
  after?: Record<string, string>;
};

const FIXTURES_DIR = new URL('./fixtures/', import.meta.url);

/**
 * Converts fixture file maps to their canonical representation.
 *
 * 1. Paths are normalised to POSIX form so tests run consistently on all OSes.
 * 2. Every file body is ensured to end with a single trailing newline, matching
 *    how `createMemoryFs` stores content.
 *
 * @param files Optional record from the YAML fixture. When `undefined`,
 *              an empty object is returned for convenience.
 * @returns A new record with normalised paths and newline-terminated bodies.
 */
function normaliseFiles(
  files: Record<string, string> | undefined
): Record<string, string> {
  if (!files) return {};
  return Object.fromEntries(
    Object.entries(files).map(([p, body]) => [
      path.posix.normalize(p),
      withNL(body),
    ])
  );
}

// Generate a Bun test for every fixture in the directory.
for (const entry of readdirSync(FIXTURES_DIR)) {
  if (!/\.ya?ml$/i.test(entry)) continue;

  const fixtureUrl = new URL(entry, FIXTURES_DIR);
  const rawYaml = readFileSync(fixtureUrl, 'utf8');
  const raw: FixtureRaw = YAML.parse(rawYaml) as FixtureRaw;

  const description =
    raw.description ?? entry.replace(/\.(ya?ml)$/i, '').replace(/[-_]/g, ' ');
  const expectResult: 'success' | 'error' = raw.expect ?? 'success';
  const strict = raw.strict ?? false;
  const before = normaliseFiles(raw.before);
  const after = normaliseFiles(raw.after);
  const patch = raw.patch;

  test(description, async () => {
    const memfs = createMemoryFs(before);

    const run = () => applyPatch(patch, { fs: memfs, strict });

    if (expectResult === 'success') {
      await expect(run()).resolves.toBeUndefined();
      expect(memfs.snapshot()).toEqual(after);
    } else {
      await expect(run()).rejects.toBeInstanceOf(ApplyPatchError);
    }
  });
}
