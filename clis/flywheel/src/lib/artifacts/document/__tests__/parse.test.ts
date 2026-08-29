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
  expect(artifact.authoredReferences[1]).toMatchObject({
    origin: 'document.replacedBy',
    raw: './new-deploy.md',
  });
});

test('distinguishes absent, malformed, and unsupported document status', () => {
  const absent = parseDocumentArtifact(
    artifactInput(
      'document',
      'customer-wide/docs/active.md',
      `---\npurpose: Explain status.\nreviewEvery: 30d\n---\n# Active\n`
    )
  );
  expect(absent).toMatchObject({
    artifacts: [
      { metadata: { lifecycle: { active: true, status: 'active' } } },
    ],
    kind: 'parsed',
    problems: [],
  });

  for (const [status, code] of [
    ['[deprecated]', 'DOCUMENT_STATUS_INVALID'],
    ['active', 'DOCUMENT_STATUS_UNSUPPORTED'],
  ] as const) {
    const compilation = parseDocumentArtifact(
      artifactInput(
        'document',
        'customer-wide/docs/invalid-status.md',
        `---\npurpose: Explain status.\nreviewEvery: 30d\nstatus: ${status}\n---\n# Invalid\n`
      )
    );
    expect(compilation.kind).toBe('unparsed');
    const problem = compilation.problems.find((item) => item.code === code);
    expect(problem?.source.start).toEqual({ column: 1, line: 4 });
    expect(JSON.stringify(compilation)).not.toContain('"status":"active"');
  }
});

test('reports unknown document frontmatter before normalization', () => {
  const compilation = parseDocumentArtifact(
    artifactInput(
      'document',
      'customer-wide/docs/unknown.md',
      `---\npurpose: Explain fields.\nreviewEvery: 30d\nreviewEvey: 7d\n---\n# Unknown\n`
    )
  );

  expect(compilation.kind).toBe('parsed');
  const problem = compilation.problems.find(
    (item) => item.code === 'DOCUMENT_FIELD_UNKNOWN'
  );
  expect(problem?.message).toBe('document contains unknown field: reviewEvey');
  expect(problem?.source.start).toEqual({ column: 1, line: 4 });
  if (compilation.kind !== 'parsed') return;
  const artifact = compilation.artifacts[0];
  if (artifact === undefined) return;
  expect('reviewEvey' in artifact).toBe(false);
});

test('marks replacedBy metadata without reinterpreting Markdown labels', () => {
  const compilation = parseDocumentArtifact(
    artifactInput(
      'document',
      'customer-wide/docs/replaced.md',
      `---\npurpose: Explain replacement.\nreviewEvery: 30d\nstatus: superseded\nreplacedBy: ./new.md\n---\n# Replaced\n\n[replacedBy](./ordinary.md)\n`
    )
  );

  expect(compilation.kind).toBe('parsed');
  if (compilation.kind !== 'parsed') return;
  const artifact = compilation.artifacts[0];
  if (artifact?.kind !== 'document') return;
  expect(artifact.authoredReferences).toMatchObject([
    {
      label: 'replacedBy',
      origin: 'document.replacedBy',
      raw: './new.md',
      relationship: 'links-to',
    },
    {
      label: 'replacedBy',
      raw: './ordinary.md',
      relationship: 'links-to',
    },
  ]);
  expect(artifact.authoredReferences[1]?.origin).toBeUndefined();
});

test('rejects secret-bearing document references without returning secrets', () => {
  const secret = 'DOCUMENT-SECRET-VALUE';
  const inputs = [
    `---\npurpose: Explain safety.\nreviewEvery: 30d\n---\n# Safe\n\n[private](https://example.test/run?access_token=${secret})\n`,
    `---\npurpose: Explain safety.\nreviewEvery: 30d\nstatus: superseded\nreplacedBy: https://example.test/new?api_key=${secret}\n---\n# Safe\n`,
    `---\npurpose: Explain safety.\nreviewEvery: 30d\n---\n# Safe\n\n[private](https://user:${secret}@example.test/run)\n`,
  ];

  for (const contents of inputs) {
    const compilation = parseDocumentArtifact(
      artifactInput('document', 'customer-wide/docs/secret.md', contents)
    );
    expect(compilation.kind).toBe('unparsed');
    expect(compilation.problems.map((problem) => problem.code)).toContain(
      'ARTIFACT_REFERENCE_SECRET'
    );
    expect(JSON.stringify(compilation)).not.toContain(secret);
    expect(JSON.stringify(compilation)).not.toContain('access_token');
    expect(JSON.stringify(compilation)).not.toContain('api_key');
  }
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
