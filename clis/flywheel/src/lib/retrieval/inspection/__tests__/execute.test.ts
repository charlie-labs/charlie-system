import { expect, test } from 'bun:test';

import type {
  FileReadResult,
  RepositorySource,
  RepositorySourceEntry,
} from '../../../repository/contract.js';
import { inspectArtifact } from '../execute.js';

const ENCODER = new TextEncoder();

test('composes one listing and one batch read into section inspection', async () => {
  const calls = { list: 0, read: 0 };
  const source = sourceWithDocument(
    calls,
    `---\npurpose: Explain operations.\nreviewEvery: 90d\n---\n# Guide\n\n## Operate\n\nOperate safely.\n`
  );

  const result = await inspectArtifact({
    source,
    target: 'customer-wide/docs/guide.md#operate',
  });

  expect(calls).toEqual({ list: 1, read: 1 });
  expect(result).toMatchObject({
    artifact: { kind: 'document', title: 'Guide' },
    kind: 'artifact',
    target: { anchor: 'operate', kind: 'document-section' },
  });
});

test('returns source problems for an exact unparsed artifact path', async () => {
  const result = await inspectArtifact({
    source: sourceWithDocument({ list: 0, read: 0 }, '# Missing metadata\n'),
    target: 'customer-wide/docs/guide.md',
  });

  expect(result).toMatchObject({
    entry: { artifactKind: 'document' },
    kind: 'unparsed',
  });
  if (result.kind !== 'unparsed') return;
  expect(result.problems.length).toBeGreaterThan(0);
});

function sourceWithDocument(
  calls: { list: number; read: number },
  contents: string
): RepositorySource {
  const path = 'customer-wide/docs/guide.md';
  const entries: readonly RepositorySourceEntry[] = [
    { kind: 'directory', path: 'customer-wide' },
    { kind: 'directory', path: 'customer-wide/docs' },
    { kind: 'file', path },
  ];
  return {
    listEntries: () => {
      calls.list += 1;
      return Promise.resolve(entries);
    },
    readFiles: (paths) => {
      calls.read += 1;
      const reads: FileReadResult[] = paths.map((requestedPath) => ({
        bytes: ENCODER.encode(contents),
        kind: 'read',
        path: requestedPath,
      }));
      return Promise.resolve(reads);
    },
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
}
