import { expect, test } from 'bun:test';

import { compileArtifacts } from '../../artifacts/compiler/compile.js';
import type { RepositorySource } from '../../repository/contract.js';
import { discoverRepository } from '../../repository/discover.js';
import { validateArtifacts } from '../artifacts.js';
import { validationReport } from '../diagnostics.js';

const ENCODER = new TextEncoder();

test('preserves parser incompleteness as sourced diagnostics', async () => {
  const compilations = await compile({
    'customer-wide/docs/broken.md': '# Missing metadata\n',
  });
  const report = validationReport(validateArtifacts(compilations));
  const diagnostic = report.diagnostics.find(
    (item) => item.ruleId === 'FW-ARTIFACT-FRONTMATTER-REQUIRED'
  );

  expect(report.status).toBe('incomplete');
  expect(diagnostic).toMatchObject({
    impact: 'incomplete',
    path: 'customer-wide/docs/broken.md',
    severity: 'error',
    source: { start: { column: 1, line: 1 } },
  });
});

test('validates normalized review cadences and citation integrity', async () => {
  const compilations = await compile({
    'customer-wide/catalog/entities.yaml': catalog('later'),
    'customer-wide/docs/citations.md': invalidCitations(),
  });
  const report = validationReport(validateArtifacts(compilations));
  const rules = report.diagnostics.map((diagnostic) => diagnostic.ruleId);

  expect(report.status).toBe('invalid');
  expect(ruleCount(rules, 'FW-CATALOG-REVIEW-CADENCE')).toBe(1);
  expect(ruleCount(rules, 'FW-DOCUMENT-REVIEW-CADENCE')).toBe(1);
  expect(ruleCount(rules, 'FW-DOCUMENT-CITATION-MISSING')).toBe(1);
  expect(ruleCount(rules, 'FW-DOCUMENT-CITATION-DUPLICATE')).toBe(2);
  expect(ruleCount(rules, 'FW-DOCUMENT-CITATION-UNUSED')).toBe(3);
  for (const diagnostic of report.diagnostics.filter(
    (item) => item.ruleId === 'FW-DOCUMENT-CITATION-UNUSED'
  )) {
    expect(diagnostic).toMatchObject({ impact: 'none', severity: 'warning' });
  }
});

test('reports duplicate canonical artifact targets deterministically', async () => {
  const compilations = await compile({
    'customer-wide/catalog/first.yaml': catalog('90d'),
    'customer-wide/catalog/second.yaml': catalog('90d'),
  });
  const first = validationReport(validateArtifacts(compilations));
  const second = validationReport(validateArtifacts(compilations));

  expect(first).toEqual(second);
  expect(
    first.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === 'FW-ARTIFACT-TARGET-DUPLICATE'
    )
  ).toHaveLength(2);
  expect(first.status).toBe('invalid');
});

async function compile(
  files: Readonly<Record<string, string>>
): Promise<Awaited<ReturnType<typeof compileArtifacts>>['compilations']> {
  const source = memorySource(files);
  const inventory = await discoverRepository(source);
  return (await compileArtifacts(source, inventory)).compilations;
}

function memorySource(
  files: Readonly<Record<string, string>>
): RepositorySource {
  return {
    listEntries: () =>
      Promise.resolve(
        Object.keys(files).map((path) => ({ kind: 'file' as const, path }))
      ),
    readFiles: (paths) =>
      Promise.resolve(
        paths.map((path) => {
          const contents = files[path];
          return contents === undefined
            ? { kind: 'missing' as const, path }
            : { bytes: ENCODER.encode(contents), kind: 'read' as const, path };
        })
      ),
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
}

function catalog(reviewEvery: string): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api
  annotations:
    charlie.ai/review-every: ${reviewEvery}
spec: {}
`;
}

function invalidCitations(): string {
  return `---
purpose: Demonstrate citation validation.
reviewEvery: eventually
---
# Citations

Missing evidence.[^missing]

[^duplicate]: [First](https://example.com/first)
[^duplicate]: [Second](https://example.com/second)
[^unused]: [Unused](https://example.com/unused)
`;
}

function ruleCount(rules: readonly string[], ruleId: string): number {
  return rules.filter((candidate) => candidate === ruleId).length;
}
