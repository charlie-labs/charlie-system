import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import List from '../list.js';
import Show from '../show.js';

const packageRoot = path.resolve(import.meta.dir, '../../../../../../');

test('registers leaf command metadata', () => {
  expect(List.summary).toBe('List inert Skill presets');
  expect(Show.summary).toBe('Show an inert Skill preset');
});

test('exposes generated skill and skill preset help', async () => {
  const skillHelp = await runCli(['skill', '--help']);
  const presetHelp = await runCli(['skill', 'preset', '--help']);

  expect(skillHelp.exitCode).toBe(0);
  expect(skillHelp.stderr).toBe('');
  expect(skillHelp.stdout).toContain('skill preset');
  expect(presetHelp.exitCode).toBe(0);
  expect(presetHelp.stderr).toBe('');
  expect(presetHelp.stdout).toContain('skill preset list');
  expect(presetHelp.stdout).toContain('skill preset show');
});

test('lists presets as exactly one JSON value with no stderr diagnostics', async () => {
  const result = await runCli(['skill', 'preset', 'list', '--json']);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toEqual({
    presets: [
      {
        id: 'placeholder-skill',
        payloadPath: 'payload/SKILL.md',
        specializationPath: 'SPECIALIZE.md',
      },
    ],
  });
});

test('shows payload and specialization in JSON and human modes', async () => {
  const jsonResult = await runCli([
    'skill',
    'preset',
    'show',
    'placeholder-skill',
    '--json',
  ]);
  const humanResult = await runCli([
    'skill',
    'preset',
    'show',
    'placeholder-skill',
  ]);

  expect(jsonResult.exitCode).toBe(0);
  expect(jsonResult.stderr).toBe('');
  expect(jsonResult.stdout).toContain('"payload":');
  expect(jsonResult.stdout).toContain('PLACEHOLDER');
  expect(jsonResult.stdout).toContain('before customer use');
  expect(humanResult.exitCode).toBe(0);
  expect(humanResult.stderr).toBe('');
  expect(humanResult.stdout).toContain('--- payload/SKILL.md ---');
  expect(humanResult.stdout).toContain('--- SPECIALIZE.md ---');
  expect(humanResult.stdout).toContain('PLACEHOLDER');
});

test('reports a missing preset as one JSON error value', async () => {
  const result = await runCli(['skill', 'preset', 'show', 'missing', '--json']);

  expect(result.exitCode).toBe(2);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    error: {
      type: 'SkillPresetNotFoundError',
      exitCode: 2,
    },
  });
});

test('does not change inert preset sources while showing a preset', async () => {
  const paths = [
    'presets/skills/CHANGELOG.md',
    'presets/skills/placeholder-skill/SPECIALIZE.md',
    'presets/skills/placeholder-skill/payload/SKILL.md',
  ];
  const before = await readFiles(paths);
  const result = await runCli(['skill', 'preset', 'show', 'placeholder-skill']);
  const after = await readFiles(paths);

  expect(result.exitCode).toBe(0);
  expect(after).toEqual(before);
});

async function readFiles(
  relativePaths: readonly string[]
): Promise<readonly string[]> {
  return Promise.all(
    relativePaths.map((relativePath) =>
      readFile(path.join(packageRoot, relativePath), 'utf8')
    )
  );
}

async function runCli(args: readonly string[]): Promise<
  Readonly<{
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
  }>
> {
  const child = Bun.spawn(['bun', 'run', './bin/run.ts', ...args], {
    cwd: packageRoot,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode: await child.exited, stderr, stdout };
}
