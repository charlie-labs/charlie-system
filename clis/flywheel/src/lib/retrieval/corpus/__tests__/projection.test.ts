import { expect, test } from 'bun:test';

import { validationSource } from '../../../validation/__tests__/repository-fixture.js';
import { compileAndAssessRepository } from '../../../validation/assess.js';
import { projectKnowledge } from '../project.js';

test('projects source-faithful Doc and Catalog units from one assessed repository', async () => {
  const { observation, source } = validationSource();
  const repository = await compileAndAssessRepository(source);
  const observedBeforeProjection = { ...observation };
  const projection = projectKnowledge(repository);

  expect(repository.validation.status).toBe('valid');
  expect(projection.artifacts.map((artifact) => artifact.kind)).toEqual([
    'catalog',
    'catalog',
    'document',
  ]);
  expect(
    projection.units.some(
      (unit) =>
        unit.authoredText.includes('Operate safely.[^proof]') &&
        unit.citationKeys.includes('proof') &&
        unit.headingPath.join('/') === 'Release guide' &&
        unit.structuralKind === 'prose'
    )
  ).toBe(true);
  expect(
    projection.units.some((unit) =>
      unit.authoredText.includes('namespace: default')
    )
  ).toBe(false);
  expect(
    projection.units.some(
      (unit) =>
        unit.authoredText === 'owner: group:default/platform' &&
        unit.headingPath.join('/') === 'owner' &&
        unit.structuralKind === 'catalog-field'
    )
  ).toBe(true);
  expect(projection.citations.map((item) => item.definition.key)).toEqual([
    'proof',
  ]);
  expect(() => JSON.stringify(projection)).not.toThrow();
  expect(observation).toEqual(observedBeforeProjection);
});

test('preserves complete normalized Markdown structures in source units', async () => {
  const repository = await compileAndAssessRepository(
    validationSource({
      'customer-wide/docs/structured.md': `---
purpose: Preserve authored structure.
reviewEvery: 90d
---
# Structured guide

1. First step
2. Second step

\`\`\`ts
const ready = true;
\`\`\`

| State | Meaning |
| --- | --- |
| ready | Continue |
`,
    }).source
  );
  const projection = projectKnowledge(repository);

  expect(projection.units.map((unit) => unit.structuralKind)).toEqual([
    'list',
    'code',
    'table',
  ]);
  expect(projection.units.map((unit) => unit.authoredText)).toEqual([
    '1. First step\n2. Second step',
    '```ts\nconst ready = true;\n```',
    '| State | Meaning |\n| --- | --- |\n| ready | Continue |',
  ]);
});
