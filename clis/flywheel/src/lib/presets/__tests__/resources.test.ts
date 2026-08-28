import { expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { sortedCopy } from '../../content/ordering.js';
import { createFlywheelDeps } from '../../runtime/deps.js';

const packageRoot = path.resolve(import.meta.dir, '../../../..');
const presetsRoot = path.join(packageRoot, 'presets');

test('keeps the fixed collection layout and no active daemon root', async () => {
  expect(await names(path.join(presetsRoot, 'roles'))).toEqual([
    'CHANGELOG.md',
  ]);
  expect(await names(path.join(presetsRoot, 'daemons'))).toEqual([
    'CHANGELOG.md',
  ]);
  expect(await names(path.join(presetsRoot, 'skills'))).toEqual([
    'CHANGELOG.md',
    'placeholder-skill',
  ]);
  expect(await exists(path.join(packageRoot, 'system', 'daemons'))).toBe(false);
});

test('keeps the placeholder payload contract-valid and visibly inert', async () => {
  const payloadPath = path.join(
    presetsRoot,
    'skills/placeholder-skill/payload/SKILL.md'
  );
  const specializationPath = path.join(
    presetsRoot,
    'skills/placeholder-skill/SPECIALIZE.md'
  );
  const [payload, specialization] = await Promise.all([
    readFile(payloadPath, 'utf8'),
    readFile(specializationPath, 'utf8'),
  ]);

  expect(payload).toMatch(
    /^---\nname: placeholder-skill\ndescription: .+\n---\n/u
  );
  expect(payload).toContain('PLACEHOLDER');
  expect(payload).toContain(
    'Replace or specialize this payload before customer use.'
  );
  expect(specialization).toContain('PLACEHOLDER');
  expect(specialization).toContain(
    'Replace or specialize the payload and this guidance before customer use.'
  );
  expect(`${payload}\n${specialization}`).not.toMatch(
    /(?:api[_-]?key|bearer\s+|-----begin|sk-[a-z0-9])/iu
  );
});

async function names(directoryPath: string): Promise<readonly string[]> {
  const entries = await createFlywheelDeps().filesystem.readdir(directoryPath);
  return sortedCopy(
    entries.map((entry) => entry.name),
    (left, right) => left.localeCompare(right)
  );
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
