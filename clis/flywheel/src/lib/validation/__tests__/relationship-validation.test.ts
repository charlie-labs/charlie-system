import { expect, test } from 'bun:test';

import { compileRepository } from '../../projection/compile.js';
import { buildRepositoryIndexes } from '../../projection/indexes.js';
import { validateRelationships } from '../relationships.js';
import { validateRepository } from '../validate.js';
import {
  validCatalog,
  validDocument,
  validRole,
  validationSource,
} from './repository-fixture.js';

test('diagnoses every unresolved reference outcome with authored provenance', async () => {
  const document = validDocument(`
[Missing](./missing.md)
[Unsupported](mailto:test@example.com)
[Invalid](https:broken)
[Ambiguous](shared)
`);
  const { source } = validationSource({
    'customer-wide/.agents/skills/shared/SKILL.md': validSkill(),
    'customer-wide/catalog/entities.yaml': validCatalog(),
    'customer-wide/docs/guide.md': document,
    'roles/shared.yaml': validRole()
      .replaceAll('release-manager', 'shared')
      .replace('Keep releases dependable.', 'Share knowledge.'),
  });
  const projection = await compileRepository(source);
  const diagnostics = validateRelationships(
    projection,
    buildRepositoryIndexes(projection)
  ).filter((diagnostic) => diagnostic.ruleId.startsWith('FW-REFERENCE-'));

  expect(diagnostics.map((diagnostic) => diagnostic.ruleId)).toEqual([
    'FW-REFERENCE-UNKNOWN',
    'FW-REFERENCE-UNSUPPORTED',
    'FW-REFERENCE-INVALID',
    'FW-REFERENCE-AMBIGUOUS',
  ]);
  for (const diagnostic of diagnostics) {
    expect(diagnostic).toMatchObject({
      impact: 'invalid',
      path: 'customer-wide/docs/guide.md',
      severity: 'error',
      source: { path: 'customer-wide/docs/guide.md' },
      target: 'document:customer-wide%2Fdocs%2Fguide.md',
    });
  }
});

test('requires every Role to have a resolved member Daemon', async () => {
  const { source } = validationSource({
    'roles/release-manager.yaml': validRole(),
  });
  const projection = await compileRepository(source);
  const diagnostics = validateRelationships(
    projection,
    buildRepositoryIndexes(projection)
  );

  expect(diagnostics).toEqual([
    expect.objectContaining({
      path: 'roles/release-manager.yaml',
      ruleId: 'FW-ROLE-MEMBER-REQUIRED',
      target: 'role:release-manager',
    }),
  ]);
});

test('does not count a Daemon with unresolved policy references as valid', async () => {
  const { source } = validationSource({
    'customer-wide/.agents/daemons/release-review/DAEMON.md':
      daemonWithBrokenLink(),
    'roles/release-manager.yaml': validRole(),
  });
  const projection = await compileRepository(source);
  const diagnostics = validateRelationships(
    projection,
    buildRepositoryIndexes(projection)
  );

  expect(diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain(
    'FW-ROLE-MEMBER-REQUIRED'
  );
});

test('requires a superseded document replacement to remain active', async () => {
  const oldDocument = `---
purpose: Point to the replacement.
reviewEvery: 90d
status: superseded
replacedBy: ./replacement.md
---
# Old

Use the replacement.
`;
  const replacement = `---
purpose: Retain legacy replacement details.
reviewEvery: 90d
status: deprecated
---
# Replacement

Legacy details.
`;
  const { source } = validationSource({
    'customer-wide/docs/old.md': oldDocument,
    'customer-wide/docs/replacement.md': replacement,
  });
  const projection = await compileRepository(source);
  const diagnostics = validateRelationships(
    projection,
    buildRepositoryIndexes(projection)
  );

  expect(diagnostics).toEqual([
    expect.objectContaining({
      field: 'replacedBy',
      ruleId: 'FW-DOCUMENT-REPLACEMENT-INACTIVE',
      target: 'document:customer-wide%2Fdocs%2Fold.md',
    }),
  ]);
});

test('allows replacedBy only on superseded source documents', async () => {
  await Promise.all(
    ([undefined, 'active', 'deprecated'] as const).map(async (status) => {
      const { source } = validationSource({
        'customer-wide/docs/source.md': replacementDocument({
          replacedBy: './replacement.md',
          ...(status === undefined ? {} : { status }),
        }),
        'customer-wide/docs/replacement.md': replacementDocument({}),
      });
      const projection = await compileRepository(source);
      const diagnostics = validateRelationships(
        projection,
        buildRepositoryIndexes(projection)
      );

      expect(diagnostics).toEqual([
        expect.objectContaining({
          field: 'replacedBy',
          path: 'customer-wide/docs/source.md',
          ruleId: 'FW-DOCUMENT-REPLACEMENT-SOURCE-LIFECYCLE',
          target: 'document:customer-wide%2Fdocs%2Fsource.md',
        }),
      ]);
    })
  );
});

test('keeps non-Document replacement targets unresolved and out of the graph', async () => {
  await Promise.all(
    [
      'https://example.test/replacement',
      '/tasks/task_123',
      '../catalog/entities.yaml',
    ].map(async (replacedBy) => {
      const { source } = validationSource({
        'customer-wide/catalog/entities.yaml': validCatalog(),
        'customer-wide/docs/source.md': replacementDocument({
          replacedBy,
          status: 'superseded',
        }),
      });
      const projection = await compileRepository(source);
      const report = validateRepository(
        projection,
        buildRepositoryIndexes(projection)
      );

      expect(report.status).toBe('invalid');
      expect(
        projection.resolutions.find(
          (resolution) => resolution.authored.origin === 'document.replacedBy'
        )
      ).toMatchObject({ kind: 'unresolved' });
      expect(
        report.diagnostics.find(
          (diagnostic) =>
            diagnostic.path === 'customer-wide/docs/source.md' &&
            diagnostic.ruleId.startsWith('FW-REFERENCE-')
        )
      ).toBeDefined();
      expect(
        projection.graph.relationships.filter(
          (relationship) => relationship.kind === 'supersedes'
        )
      ).toEqual([]);
    })
  );
});

function validSkill(): string {
  return `---
name: shared
description: Share useful knowledge.
---
# Shared

Share knowledge.
`;
}

function daemonWithBrokenLink(): string {
  return `---
id: release-review
purpose: Review releases.
role: release-manager
watch: A release changes.
routines: Review the release.
---
# Release review

Read the [missing policy](./missing.md).
`;
}

function replacementDocument(input: {
  readonly replacedBy?: string;
  readonly status?: 'active' | 'deprecated' | 'superseded';
}): string {
  return `---
purpose: Explain replacement behavior.
reviewEvery: 90d
${input.status === undefined ? '' : `status: ${input.status}\n`}${
    input.replacedBy === undefined
      ? ''
      : `replacedBy: ${JSON.stringify(input.replacedBy)}\n`
  }---
# Replacement guide

Use the current guidance.
`;
}
