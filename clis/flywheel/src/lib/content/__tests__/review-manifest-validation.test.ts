import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  makeRepository,
  validate,
} from './whole-repository-validation-test-helpers.js';

afterEach(cleanupTemporaryDirectories);

test('rejects quoted review manifest schema versions', async () => {
  const results = await Promise.all(
    ['"1"', "'1'"].map(async (schemaVersion) => {
      const repositoryPath = await makeRepository({
        '.flywheel/reviews.yaml': [
          `schemaVersion: ${schemaVersion}`,
          'reviews:',
          '',
        ].join('\n'),
      });
      return validate(repositoryPath);
    })
  );

  for (const result of results) {
    expect(result.diagnostics).toContainEqual({
      field: 'schemaVersion',
      message: 'review manifest schemaVersion must be 1',
      path: '.flywheel/reviews.yaml',
      ruleId: 'FW-REVIEW-001',
      severity: 'error',
    });
  }
});

test('reports duplicate top-level review manifest sections', async () => {
  const repositoryPath = await makeRepository({
    '.flywheel/reviews.yaml': [
      'schemaVersion: 1',
      'schemaVersion: 1',
      'reviews:',
      'reviews:',
      '',
    ].join('\n'),
  });

  const result = await validate(repositoryPath);

  expect(result.diagnostics).toEqual([
    {
      field: 'reviews',
      message: 'review manifest field is duplicated: reviews',
      path: '.flywheel/reviews.yaml',
      ruleId: 'FW-REVIEW-001',
      severity: 'error',
      source: { column: 1, line: 4 },
    },
    {
      field: 'schemaVersion',
      message: 'review manifest field is duplicated: schemaVersion',
      path: '.flywheel/reviews.yaml',
      ruleId: 'FW-REVIEW-001',
      severity: 'error',
      source: { column: 1, line: 2 },
    },
  ]);
});
