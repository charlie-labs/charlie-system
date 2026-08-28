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

test('returns a nonzero result for invalid review manifests', async () => {
  const repositoryPath = await makeRepository({
    '.flywheel/reviews.yaml': [
      'schemaVersion: "1"',
      'schemaVersion: 1',
      'reviews:',
      'reviews:',
      '',
    ].join('\n'),
  });
  const [json, human] = await Promise.all([
    runCli([
      'content',
      'validate',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli(['content', 'validate', '--repository-path', repositoryPath]),
  ]);

  expect(json.exitCode).toBe(1);
  expect(json.stderr).toBe('');
  expect(JSON.parse(json.stdout)).toMatchObject({
    error: {
      diagnostics: [
        {
          field: 'reviews',
          ruleId: 'FW-REVIEW-001',
        },
        {
          field: 'schemaVersion',
          message: 'review manifest schemaVersion must be 1',
          ruleId: 'FW-REVIEW-001',
        },
        {
          field: 'schemaVersion',
          ruleId: 'FW-REVIEW-001',
        },
      ],
      exitCode: 1,
      type: 'ContentValidationError',
    },
  });
  expect(human.exitCode).toBe(1);
  expect(human.stdout).toBe('');
  expect(human.stderr).toContain('error FW-REVIEW-001');
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
      type: 'PresetNotFoundError',
    },
  });
});
