import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AsyncFileSystem } from '../../runtime/deps.js';
import { createFlywheelDeps } from '../../runtime/deps.js';
import { PresetInvocationError, PresetNotFoundError } from '../errors.js';
import { listSkillPresets, showSkillPreset } from '../inspection.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true }))
  );
});

test('lists direct preset directories in deterministic order', async () => {
  const sourceRoot = await makePresetRoot({
    'zeta-skill': 'Zeta payload',
    'alpha-skill': 'Alpha payload',
  });
  const result = await listSkillPresets({
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result.presets.map((preset) => preset.id)).toEqual([
    'alpha-skill',
    'zeta-skill',
  ]);
  expect(result.presets[0]).toEqual({
    id: 'alpha-skill',
    payloadPath: 'payload/SKILL.md',
    specializationPath: 'SPECIALIZE.md',
  });
});

test('treats a missing source root as a successful empty list', async () => {
  const sourceRoot = path.join(await makeTemporaryDirectory(), 'skills');
  const result = await listSkillPresets({
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({ presets: [] });
});

test('reads the selected payload and specialization without writes', async () => {
  const sourceRoot = await makePresetRoot({
    'alpha-skill': 'payload text',
  });
  const baseFilesystem = createFlywheelDeps().filesystem;
  const calls: string[] = [];
  const filesystem: AsyncFileSystem = {
    readFile: async (filePath) => {
      calls.push(`readFile:${filePath}`);
      return baseFilesystem.readFile(filePath);
    },
    readFileBytes: async (filePath) => {
      calls.push(`readFileBytes:${filePath}`);
      return baseFilesystem.readFileBytes(filePath);
    },
    readdir: async (directoryPath) => {
      calls.push(`readdir:${directoryPath}`);
      return baseFilesystem.readdir(directoryPath);
    },
    lstat: async (filePath) => {
      calls.push(`lstat:${filePath}`);
      return baseFilesystem.lstat(filePath);
    },
    stat: async (filePath) => {
      calls.push(`stat:${filePath}`);
      return baseFilesystem.stat(filePath);
    },
  };

  const result = await showSkillPreset({
    filesystem,
    preset: 'alpha-skill',
    sourceRoot,
  });

  expect(result.payload).toBe('payload text');
  expect(result.specialization).toContain('alpha-skill');
  expect(calls.filter((call) => call.startsWith('readFile:'))).toHaveLength(2);
  expect(calls.some((call) => call.startsWith('readdir:'))).toBe(false);
});

test('rejects missing and unsafe preset identities', async () => {
  const sourceRoot = await makePresetRoot({
    'alpha-skill': 'payload text',
  });
  const filesystem = createFlywheelDeps().filesystem;

  const missing = captureFailure(() =>
    showSkillPreset({ filesystem, preset: 'missing', sourceRoot })
  );
  const unsafe = captureFailure(() =>
    showSkillPreset({ filesystem, preset: '../alpha-skill', sourceRoot })
  );

  expect(await missing).toBeInstanceOf(PresetNotFoundError);
  expect(await unsafe).toBeInstanceOf(PresetInvocationError);
});

test('does not follow a symlinked preset directory', async () => {
  const sourceRoot = await makePresetRoot({
    'target-skill': 'payload text',
  });
  await symlink(
    path.join(sourceRoot, 'target-skill'),
    path.join(sourceRoot, 'alpha-skill'),
    'dir'
  );

  const error = await captureFailure(() =>
    showSkillPreset({
      filesystem: createFlywheelDeps().filesystem,
      preset: 'alpha-skill',
      sourceRoot,
    })
  );

  expect(error).toBeInstanceOf(PresetNotFoundError);
});

async function captureFailure(
  action: () => Promise<unknown>
): Promise<unknown> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
}

async function makePresetRoot(
  presets: Readonly<Record<string, string>>
): Promise<string> {
  const sourceRoot = await makeTemporaryDirectory();
  await writeFile(
    path.join(sourceRoot, 'CHANGELOG.md'),
    '# changelog\n',
    'utf8'
  );
  await writeFile(path.join(sourceRoot, 'README.md'), 'ignored\n', 'utf8');
  await Promise.all(
    Object.entries(presets).map(async ([preset, payload]) => {
      const presetRoot = path.join(sourceRoot, preset);
      await mkdir(path.join(presetRoot, 'payload'), { recursive: true });
      await writeFile(
        path.join(presetRoot, 'payload/SKILL.md'),
        payload,
        'utf8'
      );
      await writeFile(
        path.join(presetRoot, 'SPECIALIZE.md'),
        `specialize ${preset}`,
        'utf8'
      );
    })
  );
  return sourceRoot;
}

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp('/tmp/flywheel-presets-');
  temporaryDirectories.push(directory);
  return directory;
}
