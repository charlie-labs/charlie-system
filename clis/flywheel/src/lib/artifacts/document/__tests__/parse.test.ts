import { expect, test } from 'bun:test';

import { artifactInput } from '../../__tests__/parse-input.js';
import { parseDocumentArtifact } from '../parse.js';

const validDocument = `---
purpose: Explain deployment.
reviewEvery: 90d
about:
  - component:default/api
status: superseded
replacedBy: ./new-deploy.md
---
# Deploy

Read the [runbook](../runbook.md).

## Steps

1. Build.
2. Deploy.
`;

test('parses durable document metadata and source-faithful content', () => {
  const compilation = parseDocumentArtifact(
    artifactInput('document', 'customer-wide/docs/deploy.md', validDocument)
  );

  expect(compilation.kind).toBe('parsed');
  if (compilation.kind !== 'parsed') return;
  expect(compilation.problems).toEqual([]);
  expect(compilation.artifacts).toHaveLength(1);
  expect(compilation.artifacts[0]).toMatchObject({
    kind: 'document',
    metadata: {
      about: ['component:default/api'],
      lifecycle: { active: false, status: 'superseded' },
      replacedBy: './new-deploy.md',
    },
    title: 'Deploy',
  });
  const artifact = compilation.artifacts[0];
  if (artifact?.kind !== 'document') return;
  expect(artifact.sections.map((section) => section.heading)).toEqual([
    'Deploy',
    'Steps',
  ]);
  expect(artifact.sections[1]?.fragments[0]).toMatchObject({
    kind: 'list',
    ordered: true,
  });
  expect(artifact.authoredReferences.map((reference) => reference.raw)).toEqual(
    ['component:default/api', './new-deploy.md', '../runbook.md']
  );
});

test('keeps a document with missing required metadata visible as unparsed', () => {
  const compilation = parseDocumentArtifact(
    artifactInput(
      'document',
      'customer-wide/docs/incomplete.md',
      `---\nreviewEvery: 30d\n---\n# Incomplete\n`
    )
  );

  expect(compilation.kind).toBe('unparsed');
  expect(compilation.problems.map((problem) => problem.code)).toContain(
    'DOCUMENT_FIELD_REQUIRED'
  );
});
