import { expect, test } from 'bun:test';

import { compileRepository } from '../../projection/compile.js';
import { buildRepositoryIndexes } from '../../projection/indexes.js';
import { retrievalAssessmentState } from '../../retrieval/assessment/state.js';
import { assessRepository, compileAndAssessRepository } from '../assess.js';
import { validateRepository } from '../validate.js';
import { validationSource } from './repository-fixture.js';

test('associates one assessment with the exact projection after one source pass', async () => {
  const { observation, source } = validationSource();
  const repository = await compileAndAssessRepository(source);

  expect(repository.validation.status).toBe('valid');
  expect(observation).toEqual({
    listCalls: 1,
    readCalls: 1,
    readPaths: [
      [
        'customer-wide/.agents/daemons/release-review/DAEMON.md',
        'customer-wide/catalog/entities.yaml',
        'customer-wide/docs/guide.md',
        'roles/release-manager.yaml',
      ],
    ],
  });
  expect(retrievalAssessmentState(repository)).toEqual({
    kind: 'valid',
    repository,
  });
});

test('keeps invalid and incomplete assessment states explicit for retrieval', async () => {
  const invalid = await compileAndAssessRepository(
    validationSource({ 'customer-wide/AGENTS.md': 'Rules.\n' }).source
  );
  const incomplete = await compileAndAssessRepository(
    validationSource({ 'customer-wide/docs/broken.md': '# Broken\n' }).source
  );

  expect(retrievalAssessmentState(invalid)).toEqual({
    kind: 'invalid',
    repository: invalid,
  });
  expect(retrievalAssessmentState(incomplete)).toEqual({
    kind: 'incomplete',
    repository: incomplete,
  });
  expect(invalid.validation.diagnostics).not.toHaveLength(0);
  expect(incomplete.validation.diagnostics).not.toHaveLength(0);
});

test('assesses the exact projection and report without copying or mutation', async () => {
  const projection = await compileRepository(validationSource().source);
  const before = JSON.stringify(projection);
  const validation = validateRepository(
    projection,
    buildRepositoryIndexes(projection)
  );
  const repository = assessRepository(projection, validation);

  expect(repository.projection).toBe(projection);
  expect(repository.validation).toBe(validation);
  expect(JSON.stringify(projection)).toBe(before);
});
