import { expect, test } from 'bun:test';

import type {
  FileReadResult,
  RepositoryInventory,
  RepositorySource,
  RepositoryState,
} from '../../../repository/contract.js';
import { RepositorySourceError } from '../../../repository/errors.js';
import { compileArtifacts } from '../compile.js';

const ENCODER = new TextEncoder();
const state: RepositoryState = {
  kind: 'working-tree',
  repositoryPath: '/knowledge',
};

test('batch reads accepted files and compiles each inventory entry once', async () => {
  const readCalls: string[][] = [];
  const inventory = artifactInventory();
  const source = repositorySource(readCalls, [
    read(
      'customer-wide/docs/guide.md',
      `---\npurpose: Explain the system.\nreviewEvery: 90d\n---\n# Guide\n`
    ),
    read(
      'roles/operator.yaml',
      'schemaVersion: role.v0\nid: operator\nobjective: Operate safely.\n'
    ),
  ]);

  const compiled = await compileArtifacts(source, inventory);

  expect(readCalls).toEqual([
    [
      'customer-wide/docs/guide.md',
      'roles/operator.yaml',
      'customer-wide/.agents/skills/missing/SKILL.md',
    ],
  ]);
  expect(compiled.artifacts.map((artifact) => artifact.kind)).toEqual([
    'document',
    'role',
  ]);
  expect(compiled.compilations.map((result) => result.kind)).toEqual([
    'parsed',
    'parsed',
    'unparsed',
  ]);
  expect(compiled.compilations[2]?.problems[0]?.code).toBe(
    'ARTIFACT_SOURCE_MISSING'
  );
});

test('rejects a source that does not match the discovered repository state', () => {
  const source = repositorySource([], []);
  const inventory: RepositoryInventory = {
    ...artifactInventory(),
    state: { kind: 'working-tree', repositoryPath: '/elsewhere' },
  };

  expect(compileArtifacts(source, inventory)).rejects.toBeInstanceOf(
    RepositorySourceError
  );
});

function artifactInventory(): RepositoryInventory {
  return {
    directories: [],
    entries: [
      inventoryArtifact('document', 'customer-wide/docs/guide.md', {
        kind: 'customer-wide',
      }),
      inventoryArtifact('role', 'roles/operator.yaml', { kind: 'roles' }),
      inventoryArtifact(
        'skill',
        'customer-wide/.agents/skills/missing/SKILL.md',
        { kind: 'customer-wide' }
      ),
    ],
    repositories: [],
    state,
  };
}

function inventoryArtifact(
  artifactKind: 'document' | 'role' | 'skill',
  path: string,
  region: { readonly kind: 'customer-wide' | 'roles' }
): RepositoryInventory['entries'][number] {
  return { artifactKind, kind: 'artifact', path, region };
}

function repositorySource(
  calls: string[][],
  reads: readonly FileReadResult[]
): RepositorySource {
  return {
    listEntries: () => Promise.resolve([]),
    readFiles: (paths) => {
      calls.push([...paths]);
      return Promise.resolve(reads);
    },
    state,
  };
}

function read(path: string, contents: string): FileReadResult {
  return { bytes: ENCODER.encode(contents), kind: 'read', path };
}
