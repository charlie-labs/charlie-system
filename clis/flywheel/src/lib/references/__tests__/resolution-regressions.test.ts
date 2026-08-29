import { expect, test } from 'bun:test';

import { artifactExamples } from '../../artifacts/__tests__/artifact-fixtures.js';
import type { CompiledArtifacts } from '../../artifacts/compiler/contract.js';
import type {
  ArtifactCompilation,
  FlywheelArtifact,
} from '../../artifacts/contract.js';
import type {
  RepositoryEntry,
  RepositoryInventory,
} from '../../repository/contract.js';
import { sourceLocation } from '../../repository/location.js';
import { documentTarget } from '../../targets/id.js';
import type { AuthoredReference, ReferenceResolution } from '../contract.js';
import { buildReferenceIndex } from '../index.js';
import { resolveReferences } from '../resolve.js';

const repositoryState = {
  kind: 'working-tree' as const,
  repositoryPath: '/knowledge',
};

test('applies relationship target constraints to external identities', () => {
  const path = 'customer-wide/docs/guide.md';
  const document = documentArtifact(path, [
    {
      ...reference(path, 'https://example.test/replacement', 'links-to'),
      label: 'replacedBy',
      origin: 'document.replacedBy',
    },
    reference(path, '/tasks/task_123', 'contributes-to'),
    reference(path, 'https://linear.app/acme/issue/BOT-42/tracking', 'about'),
  ]);
  const resolutions = resolveFixture([document]);

  expect(resolutions).toHaveLength(3);
  expect(
    resolutions.map((resolution) => ({
      kind: resolution.kind,
      reason: resolution.kind === 'unresolved' ? resolution.reason : undefined,
    }))
  ).toEqual([
    { kind: 'unresolved', reason: 'unsupported-target' },
    { kind: 'unresolved', reason: 'unsupported-target' },
    { kind: 'unresolved', reason: 'unsupported-target' },
  ]);
});

test('redacts secret-bearing resolver inputs while preserving source location', () => {
  const path = 'customer-wide/docs/guide.md';
  const secret = 'RESOLVER-SECRET-VALUE';
  for (const raw of [
    `https://example.test/run?access_token=${secret}`,
    `https://example.test/callback#access_token=${secret}`,
  ]) {
    const document = documentArtifact(path, [reference(path, raw, 'links-to')]);
    const [resolution] = resolveFixture([document]);

    expect(resolution).toMatchObject({
      authored: {
        source: {
          path,
          start: { column: 1, line: 3 },
        },
      },
      kind: 'unresolved',
      reason: 'invalid-syntax',
    });
    const serialized = JSON.stringify(resolution);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('access_token');
  }
});

test('keeps support identity path-stable for shared and failed-owner resources', () => {
  const guidePath = 'customer-wide/docs/guide.md';
  const otherPath = 'customer-wide/docs/other.md';
  const shared = './assets/diagram.png';
  const failedOwner = '../.agents/daemons/broken-review/CHECKLIST.md';
  const artifacts = [
    documentArtifact(guidePath, [
      reference(guidePath, shared, 'links-to'),
      reference(guidePath, failedOwner, 'links-to'),
    ]),
    documentArtifact(otherPath, [reference(otherPath, shared, 'links-to')]),
  ];
  const resolutions = resolveFixture(artifacts, [
    supportEntry('customer-wide/docs/assets/diagram.png', 'document'),
    supportEntry(
      'customer-wide/.agents/daemons/broken-review/CHECKLIST.md',
      'daemon',
      'customer-wide/.agents/daemons/broken-review/DAEMON.md'
    ),
  ]);
  const supportTargets = resolutions.flatMap((resolution) =>
    resolution.kind === 'resolved' &&
    resolution.target.kind === 'support-resource'
      ? [resolution.target]
      : []
  );

  expect(supportTargets).toEqual([
    {
      kind: 'support-resource',
      path: 'customer-wide/docs/assets/diagram.png',
    },
    {
      kind: 'support-resource',
      path: 'customer-wide/.agents/daemons/broken-review/CHECKLIST.md',
    },
    {
      kind: 'support-resource',
      path: 'customer-wide/docs/assets/diagram.png',
    },
  ]);
});

function resolveFixture(
  artifacts: readonly FlywheelArtifact[],
  support: readonly RepositoryEntry[] = []
): readonly ReferenceResolution[] {
  const fixture = fixtureInput(artifacts, support);
  return resolveReferences({
    artifacts,
    index: buildReferenceIndex(fixture),
  });
}

function fixtureInput(
  artifacts: readonly FlywheelArtifact[],
  support: readonly RepositoryEntry[]
): Readonly<{
  readonly compiled: CompiledArtifacts;
  readonly inventory: RepositoryInventory;
}> {
  const compilations = artifacts.map((artifact) => parsedCompilation(artifact));
  return {
    compiled: { artifacts, compilations, state: repositoryState },
    inventory: {
      directories: [],
      entries: [...compilations.map((item) => item.entry), ...support],
      repositories: [],
      state: repositoryState,
    },
  };
}

function documentArtifact(
  path: string,
  authoredReferences: readonly AuthoredReference[]
): Extract<FlywheelArtifact, { readonly kind: 'document' }> {
  const template = artifactExamples().find(
    (artifact) => artifact.kind === 'document'
  );
  if (template === undefined) {
    throw new Error('document fixture is missing');
  }
  return {
    ...template,
    authoredReferences,
    path,
    sections: [],
    source: sourceLocation(path, { column: 1, line: 1 }),
    target: documentTarget(path),
  };
}

function parsedCompilation(artifact: FlywheelArtifact): ArtifactCompilation {
  return {
    artifacts: [artifact],
    entry: {
      artifactKind: artifact.kind,
      kind: 'artifact',
      path: artifact.path,
      region: artifact.region,
    },
    kind: 'parsed',
    problems: [],
  };
}

function supportEntry(
  path: string,
  artifactKind: 'daemon' | 'document',
  owner?: string
): RepositoryEntry {
  return artifactKind === 'document'
    ? {
        artifactKind,
        kind: 'support-file',
        path,
        region: { kind: 'customer-wide' },
      }
    : {
        artifactKind,
        kind: 'support-file',
        owner: owner ?? '',
        path,
        region: { kind: 'customer-wide' },
      };
}

function reference(
  path: string,
  raw: string,
  relationship: AuthoredReference['relationship']
): AuthoredReference {
  return {
    raw,
    relationship,
    source: sourceLocation(path, { column: 1, line: 3 }),
  };
}
