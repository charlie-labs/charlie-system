import { expect, test } from 'bun:test';

import { compileRepository } from '../../projection/compile.js';
import type { RepositoryProjection } from '../../projection/contract.js';
import { buildRepositoryIndexes } from '../../projection/indexes.js';
import { validateRepository } from '../validate.js';
import {
  validRepositoryFiles,
  validationSource,
} from './repository-fixture.js';

test('assesses a conforming compiled repository as valid', async () => {
  const { source } = validationSource();
  const projection = await compileRepository(source);
  const report = validateRepository(
    projection,
    buildRepositoryIndexes(projection)
  );

  expect(report).toEqual({ diagnostics: [], status: 'valid' });
});

test('keeps prohibited, unsupported, and orphaned bundle material visible', async () => {
  const files = {
    ...validRepositoryFiles(),
    'README.md': 'Repository infrastructure.\n',
    'customer-wide/.agents/skills/orphan/HELPER.md': 'Orphaned support.\n',
    'customer-wide/AGENTS.md': 'Rule content.\n',
    'customer-wide/unknown.txt': 'Unsupported governed content.\n',
  };
  const { source } = validationSource(files);
  const projection = await compileRepository(source);
  const report = validateRepository(
    projection,
    buildRepositoryIndexes(projection)
  );

  expect(report.status).toBe('invalid');
  expect(
    report.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === 'FW-REPOSITORY-UNSUPPORTED'
    )
  ).toHaveLength(2);
  expect(report.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
    'FW-BUNDLE-OWNER-MISSING'
  );
  expect(report.diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
    'FW-REPOSITORY-RULE-PROHIBITED'
  );
  expect(
    report.diagnostics.find((diagnostic) => diagnostic.path === 'README.md')
  ).toMatchObject({
    impact: 'none',
    ruleId: 'FW-REPOSITORY-UNSUPPORTED',
    severity: 'warning',
  });
});

test('detects missing compilation and graph targets without repository access', async () => {
  const { source } = validationSource();
  const projection = await compileRepository(source);
  const documentId = 'document:customer-wide%2Fdocs%2Fguide.md';
  const incomplete = {
    ...projection,
    compilations: projection.compilations.filter(
      (compilation) => compilation.entry.path !== 'customer-wide/docs/guide.md'
    ),
  } satisfies RepositoryProjection;
  const invalid = {
    ...projection,
    graph: {
      ...projection.graph,
      targets: projection.graph.targets.filter(
        (record) => record.id !== documentId
      ),
    },
  } satisfies RepositoryProjection;

  expect(
    validateRepository(incomplete, buildRepositoryIndexes(incomplete))
  ).toMatchObject({
    diagnostics: [
      expect.objectContaining({
        impact: 'incomplete',
        ruleId: 'FW-PROJECTION-COMPILATION-MISSING',
      }),
    ],
    status: 'incomplete',
  });
  const invalidReport = validateRepository(
    invalid,
    buildRepositoryIndexes(invalid)
  );
  expect(invalidReport.status).toBe('invalid');
  expect(
    invalidReport.diagnostics.map((diagnostic) => diagnostic.ruleId)
  ).toContain('FW-GRAPH-ARTIFACT-TARGET-MISSING');
  expect(
    invalidReport.diagnostics.map((diagnostic) => diagnostic.ruleId)
  ).toContain('FW-GRAPH-RELATIONSHIP-TARGET-MISSING');
});

test('semantic invalidity takes precedence without hiding incompleteness', async () => {
  const { source } = validationSource({
    'customer-wide/AGENTS.md': 'Rules are prohibited.\n',
    'customer-wide/docs/broken.md': '# Missing metadata\n',
  });
  const projection = await compileRepository(source);
  const report = validateRepository(
    projection,
    buildRepositoryIndexes(projection)
  );

  expect(report.status).toBe('invalid');
  expect(report.diagnostics.map((diagnostic) => diagnostic.impact)).toContain(
    'incomplete'
  );
  expect(report.diagnostics.map((diagnostic) => diagnostic.impact)).toContain(
    'invalid'
  );
});
