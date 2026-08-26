import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
  validDocument,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves content JSON shape and stdout/stderr separation', async () => {
  const validRepository = await makeRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  const valid = await runCli([
    'content',
    'validate',
    '--repository-path',
    validRepository,
    '--json',
  ]);

  expect(valid.exitCode).toBe(0);
  expect(valid.stderr).toBe('');
  expect(JSON.parse(valid.stdout)).toEqual({
    diagnostics: [],
    filesChecked: 1,
  });

  const invalidRepository = await makeRepository({
    'customer-wide/docs/bad.md': 'not valid markdown\n',
  });
  const [invalidJson, invalidHuman] = await Promise.all([
    runCli([
      'content',
      'validate',
      '--repository-path',
      invalidRepository,
      '--json',
    ]),
    runCli(['content', 'validate', '--repository-path', invalidRepository]),
  ]);

  expect(invalidJson.exitCode).toBe(1);
  expect(invalidJson.stderr).toBe('');
  expect(JSON.parse(invalidJson.stdout)).toMatchObject({
    error: {
      diagnostics: [{ ruleId: 'FW-DOC-001' }],
      exitCode: 1,
      type: 'ContentValidationError',
    },
  });
  expect(invalidHuman.exitCode).toBe(1);
  expect(invalidHuman.stdout).toBe('');
  expect(invalidHuman.stderr).toContain('error FW-DOC-001');
});

test('proves Skill preset discovery and JSON output shapes', async () => {
  const [list, show, missing] = await Promise.all([
    runCli(['skill', 'preset', 'list', '--json']),
    runCli(['skill', 'preset', 'show', 'placeholder-skill', '--json']),
    runCli(['skill', 'preset', 'show', 'missing', '--json']),
  ]);

  expect(list.exitCode).toBe(0);
  expect(list.stderr).toBe('');
  expect(JSON.parse(list.stdout)).toEqual({
    presets: [
      {
        id: 'placeholder-skill',
        payloadPath: 'payload/SKILL.md',
        specializationPath: 'SPECIALIZE.md',
      },
    ],
  });
  expect(show.exitCode).toBe(0);
  expect(show.stderr).toBe('');
  expect(JSON.parse(show.stdout)).toMatchObject({
    id: 'placeholder-skill',
    payloadPath: 'payload/SKILL.md',
    specializationPath: 'SPECIALIZE.md',
  });
  expect(missing.exitCode).toBe(2);
  expect(missing.stderr).toBe('');
  expect(JSON.parse(missing.stdout)).toMatchObject({
    error: {
      exitCode: 2,
      type: 'SkillPresetNotFoundError',
    },
  });
});
