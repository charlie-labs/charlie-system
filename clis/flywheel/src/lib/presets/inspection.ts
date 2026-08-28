import path from 'node:path';

import { sortedCopy } from '../content/ordering.js';
import type { AsyncFileSystem } from '../runtime/deps.js';
import {
  PresetInvocationError,
  PresetNotFoundError,
  PresetOperationalError,
} from './errors.js';

export const SKILL_PRESET_SOURCE_ROOT = path.resolve(
  import.meta.dir,
  '../../..',
  'presets',
  'skills'
);

const PAYLOAD_PATH = 'payload/SKILL.md';
const SPECIALIZATION_PATH = 'SPECIALIZE.md';

type SkillPresetDescriptor = Readonly<{
  readonly id: string;
  readonly payloadPath: typeof PAYLOAD_PATH;
  readonly specializationPath: typeof SPECIALIZATION_PATH;
}>;

export type SkillPresetListResult = Readonly<{
  readonly presets: readonly SkillPresetDescriptor[];
}>;

export type SkillPresetShowResult = Readonly<
  SkillPresetDescriptor & {
    readonly payload: string;
    readonly specialization: string;
  }
>;

export type SkillPresetInspectionInput = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly sourceRoot: string;
}>;

export type SkillPresetShowInput = Readonly<
  SkillPresetInspectionInput & {
    readonly preset: string;
  }
>;

export async function listSkillPresets(
  input: SkillPresetInspectionInput
): Promise<SkillPresetListResult> {
  let entries;
  try {
    entries = await input.filesystem.readdir(input.sourceRoot);
  } catch (error) {
    if (isMissing(error)) {
      return { presets: [] };
    }
    throw new PresetOperationalError(
      `cannot read Skill preset source: ${input.sourceRoot}`,
      { cause: error }
    );
  }

  const presets = entries
    .filter((entry) => entry.isDirectory() && isPresetId(entry.name))
    .map((entry) => createDescriptor(entry.name));
  return {
    presets: sortedCopy(presets, (left, right) =>
      left.id.localeCompare(right.id)
    ),
  };
}

export async function showSkillPreset(
  input: SkillPresetShowInput
): Promise<SkillPresetShowResult> {
  const preset = normalizePresetId(input.preset);
  const descriptor = createDescriptor(preset);
  const presetRoot = path.join(input.sourceRoot, preset);
  await assertPresetDirectory(input.filesystem, presetRoot, preset);

  const [payload, specialization] = await Promise.all([
    readPresetFile(
      input.filesystem,
      path.join(presetRoot, descriptor.payloadPath),
      descriptor.payloadPath,
      preset
    ),
    readPresetFile(
      input.filesystem,
      path.join(presetRoot, descriptor.specializationPath),
      descriptor.specializationPath,
      preset
    ),
  ]);
  return { ...descriptor, payload, specialization };
}

function createDescriptor(id: string): SkillPresetDescriptor {
  return {
    id,
    payloadPath: PAYLOAD_PATH,
    specializationPath: SPECIALIZATION_PATH,
  };
}

function normalizePresetId(preset: string): string {
  const normalized = preset.trim();
  if (!isPresetId(normalized)) {
    throw new PresetInvocationError(`invalid Skill preset identity: ${preset}`);
  }
  return normalized;
}

function isPresetId(preset: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(preset);
}

async function assertPresetDirectory(
  filesystem: AsyncFileSystem,
  presetRoot: string,
  preset: string
): Promise<void> {
  try {
    const stats = await filesystem.stat(presetRoot);
    if (!stats.isDirectory()) {
      throw new PresetNotFoundError(preset);
    }
  } catch (error) {
    if (error instanceof PresetNotFoundError) {
      throw error;
    }
    if (isMissing(error)) {
      throw new PresetNotFoundError(preset);
    }
    throw new PresetOperationalError(`cannot inspect Skill preset: ${preset}`, {
      cause: error,
    });
  }
}

async function readPresetFile(
  filesystem: AsyncFileSystem,
  filePath: string,
  relativePath: string,
  preset: string
): Promise<string> {
  try {
    return await filesystem.readFile(filePath);
  } catch (error) {
    throw new PresetOperationalError(
      `cannot read ${relativePath} for Skill preset: ${preset}`,
      { cause: error }
    );
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
