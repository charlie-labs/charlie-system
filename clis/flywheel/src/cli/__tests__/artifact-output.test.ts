import { expect, test } from 'bun:test';

import { artifactExamples } from '../../lib/artifacts/__tests__/artifact-fixtures.js';
import { artifactInput } from '../../lib/artifacts/__tests__/parse-input.js';
import type { FlywheelArtifact } from '../../lib/artifacts/contract.js';
import { parseDocumentArtifact } from '../../lib/artifacts/document/parse.js';
import type { ArtifactInspection } from '../../lib/retrieval/inspection/contract.js';
import { targetId } from '../../lib/targets/id.js';
import { renderArtifactInspection } from '../output/artifact.js';

test('renders substantive type-specific details for every artifact kind', () => {
  const output = Object.fromEntries(
    artifactExamples().map((artifact) => [
      artifact.kind,
      renderArtifactInspection(inspection(artifact)),
    ])
  );

  expect(output['document']).toContain('purpose: Explains the system.');
  expect(output['document']).toContain('# Guide');
  expect(output['catalog']).toContain('entity: Component:default/api');
  expect(output['catalog']).toContain('"value"');
  expect(output['role']).toContain('objective: Keep releases dependable.');
  expect(output['daemon']).toContain('watch:');
  expect(output['daemon']).toContain('Review each release.');
  expect(output['skill']).toContain('description: Review a release');
  expect(output['skill']).toContain('Inspect the release.');
});

test('scopes document rendering to a selected authored subtree', () => {
  const compilation = parseDocumentArtifact(
    artifactInput('document', 'customer-wide/docs/guide.md', scopedDocument())
  );

  expect(compilation.kind).toBe('parsed');
  if (compilation.kind !== 'parsed') return;
  const artifact = compilation.artifacts[0];
  if (artifact?.kind !== 'document') return;
  const section = artifact.sections.find(
    (candidate) => candidate.target.anchor === 'operate'
  );
  expect(section).toBeDefined();
  if (section === undefined) return;

  const output = renderArtifactInspection({
    artifact,
    input: targetId(section.target),
    kind: 'artifact',
    problems: [],
    target: section.target,
    targetId: targetId(section.target),
  });

  expect(output).toContain('## Operate');
  expect(output).toContain('### Nested');
  expect(output).toContain('[^selected]: Selected citation');
  expect(output).toContain('[^nested]: Nested citation');
  expect(output).toContain('- links-to ./operate.md');
  expect(output).toContain('- links-to ./list.md');
  expect(output).toContain('- links-to ./quote.md');
  expect(output).toContain('- links-to ./nested.md');
  expect(output).toContain('- cites ./selected-citation.md');
  expect(output).toContain('- cites ./nested-citation.md');
  expect(output).not.toContain('Preamble only.');
  expect(output).not.toContain('Overview only');
  expect(output).not.toContain('Later only');
  expect(output).not.toContain('[^overview]:');
  expect(output).not.toContain('[^later]:');
  expect(output).not.toContain('[^orphan]:');
  const references = output.slice(output.indexOf('references:'));
  expect(
    references
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.replace(/\s+\([^)]*\)$/u, ''))
  ).toEqual([
    '- links-to ./operate.md',
    '- links-to ./list.md',
    '- links-to ./quote.md',
    '- links-to ./nested.md',
    '- cites ./selected-citation.md',
    '- cites ./nested-citation.md',
  ]);
  expect(references).not.toContain('component:default/api');
  expect(references).not.toContain('./replacement.md');
  expect(references).not.toContain('./overview.md');
  expect(references).not.toContain('./later.md');
  expect(references).not.toContain('./orphan-citation.md');
});

function scopedDocument(): string {
  return `---
purpose: Explain operations.
reviewEvery: 90d
about:
  - component:default/api
replacedBy: ./replacement.md
---
Preamble only.

# Guide

## Overview

Overview only [overview](./overview.md) [^overview].

## Operate

Operate safely [operate](./operate.md) [^selected].

- List operation [list](./list.md) [^selected].

> Quoted operation [quote](./quote.md) [^selected].

### Nested

Nested operation details [nested](./nested.md).

[^orphan]: Orphan citation [orphan citation](./orphan-citation.md)

## Later

Later only [later](./later.md) [^later].

[^overview]: Overview citation [overview citation](./overview-citation.md)
[^selected]: Selected citation [selected citation](./selected-citation.md) [^nested]
[^nested]: Nested citation [nested citation](./nested-citation.md)
[^later]: Later citation [later citation](./later-citation.md)
`;
}

function inspection(
  artifact: FlywheelArtifact
): Extract<ArtifactInspection, { readonly kind: 'artifact' }> {
  return {
    artifact,
    input: targetId(artifact.target),
    kind: 'artifact',
    problems: [],
    target: artifact.target,
    targetId: targetId(artifact.target),
  };
}
