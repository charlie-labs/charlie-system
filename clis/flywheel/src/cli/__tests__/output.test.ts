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
    status: 'valid',
  });

  const invalidRepository = await makeRepository({
    'customer-wide/docs/bad.md': '# Bad\n',
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
      diagnostics: [{ ruleId: 'FW-ARTIFACT-FRONTMATTER-REQUIRED' }],
      exitCode: 1,
      filesChecked: 1,
      status: 'incomplete',
      type: 'ContentValidationError',
    },
  });
  expect(invalidHuman.exitCode).toBe(1);
  expect(invalidHuman.stdout).toBe('');
  expect(invalidHuman.stderr).toContain(
    'error FW-ARTIFACT-FRONTMATTER-REQUIRED'
  );
});

test('proves Document invariant and parser diagnostics through the CLI', async () => {
  const leadRepository = await makeRepository({
    'customer-wide/docs/lead.md': validDocument.replace(
      'This is a PLACEHOLDER guide body.',
      '## Later section\n\nContent under the child heading.'
    ),
  });
  const metadataRepository = await makeRepository({
    'customer-wide/docs/metadata.md': validDocument.replace(
      'reviewEvery: 90d',
      'reviewEvery: 90d\nreviewEvey: 7d'
    ),
  });
  const [lead, metadata] = await Promise.all([
    runCli([
      'content',
      'validate',
      '--repository-path',
      leadRepository,
      '--json',
    ]),
    runCli([
      'content',
      'validate',
      '--repository-path',
      metadataRepository,
      '--json',
    ]),
  ]);

  expect(lead.exitCode).toBe(1);
  expect(JSON.parse(lead.stdout)).toMatchObject({
    error: {
      diagnostics: [
        expect.objectContaining({
          ruleId: 'FW-DOCUMENT-LEAD-PARAGRAPH-REQUIRED',
        }),
      ],
      status: 'invalid',
    },
  });
  expect(metadata.exitCode).toBe(1);
  expect(JSON.parse(metadata.stdout)).toMatchObject({
    error: {
      diagnostics: [
        expect.objectContaining({ ruleId: 'FW-DOCUMENT-FIELD-UNKNOWN' }),
      ],
      status: 'incomplete',
    },
  });
});

test('excludes tooling state from CLI validation selection and counts', async () => {
  const repositoryPath = await makeRepository({
    '.flywheel/index.sqlite': 'derived state\n',
    'customer-wide/docs/guide.md': validDocument,
  });
  const [repository, toolingState] = await Promise.all([
    runCli([
      'content',
      'validate',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'content',
      'validate',
      '.flywheel/index.sqlite',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);

  expect(repository.exitCode).toBe(0);
  expect(JSON.parse(repository.stdout)).toEqual({
    diagnostics: [],
    filesChecked: 1,
    status: 'valid',
  });
  expect(toolingState.exitCode).toBe(2);
  expect(JSON.parse(toolingState.stdout)).toMatchObject({
    error: { exitCode: 2, type: 'ContentInvocationError' },
  });
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
