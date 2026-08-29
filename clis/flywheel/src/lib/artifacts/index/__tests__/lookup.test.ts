import { expect, test } from 'bun:test';

import {
  artifactExamples,
  documentEntry,
  fixtureSource,
} from '../../__tests__/artifact-fixtures.js';
import type { CompiledArtifacts } from '../../compiler/contract.js';
import type { ArtifactCompilation, ArtifactEntry } from '../../contract.js';
import { buildArtifactIndex } from '../build.js';
import { lookupArtifact } from '../lookup.js';

test('indexes targets, section targets, aliases, and visible unparsed entries', () => {
  const index = buildArtifactIndex(compiledArtifacts());

  expect(
    lookupArtifact(index, 'customer-wide/docs/guide.md#guide')
  ).toMatchObject({
    kind: 'found',
    value: {
      artifact: { kind: 'document', title: 'Guide' },
      kind: 'inspectable',
      target: { anchor: 'guide', kind: 'document-section' },
    },
  });
  expect(lookupArtifact(index, 'component:api')).toMatchObject({
    kind: 'found',
    value: { artifact: { kind: 'catalog', name: 'api' } },
  });
  expect(lookupArtifact(index, 'customer-wide/docs/broken.md')).toMatchObject({
    kind: 'found',
    value: { kind: 'unparsed' },
  });
});

test('does not silently choose ambiguous aliases', () => {
  const lookup = lookupArtifact(
    buildArtifactIndex(compiledArtifacts()),
    'release-review'
  );

  expect(lookup.kind).toBe('ambiguous');
  if (lookup.kind !== 'ambiguous') return;
  expect(lookup.matches).toHaveLength(2);
});

test('distinguishes external identities from unknown local targets', () => {
  const index = buildArtifactIndex(compiledArtifacts());

  expect(lookupArtifact(index, 'linear:BOT-12915')).toEqual({
    input: 'linear:BOT-12915',
    kind: 'not-inspectable',
    targetKind: 'linear',
  });
  expect(lookupArtifact(index, 'https://example.com/guide')).toMatchObject({
    kind: 'not-inspectable',
    targetKind: 'web',
  });
  expect(lookupArtifact(index, 'unknown')).toEqual({
    input: 'unknown',
    kind: 'missing',
  });
  expect(lookupArtifact(index, 'component:missing')).toMatchObject({
    kind: 'missing',
  });
});

function compiledArtifacts(): CompiledArtifacts {
  const artifacts = artifactExamples();
  const compilations: ArtifactCompilation[] = [
    ...artifacts.map((artifact) => ({
      artifacts: [artifact],
      entry: artifactEntry(artifact.kind, artifact.path, artifact.region),
      kind: 'parsed' as const,
      problems: [],
    })),
    {
      entry: documentEntryAt('customer-wide/docs/broken.md'),
      kind: 'unparsed',
      problems: [
        { code: 'BROKEN', message: 'Broken document', source: fixtureSource },
      ],
    },
  ];
  return {
    artifacts,
    compilations,
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
  };
}

function artifactEntry(
  artifactKind: ArtifactEntry['artifactKind'],
  path: string,
  region: ArtifactEntry['region']
): ArtifactEntry {
  return { artifactKind, kind: 'artifact', path, region };
}

function documentEntryAt(path: string): ArtifactEntry {
  return { ...documentEntry(), path };
}
