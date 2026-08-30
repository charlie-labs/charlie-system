import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { artifactInput } from '../../../artifacts/__tests__/parse-input.js';
import { parseCatalogArtifact } from '../../../artifacts/catalog/parse.js';
import { parseDaemonArtifact } from '../../../artifacts/daemon/parse.js';
import { parseRoleArtifact } from '../../../artifacts/role/parse.js';
import {
  CUSTOMER_SCAFFOLD_ROOT,
  SOURCE_REPOSITORY_SCAFFOLD_ROOT,
} from '../roots.js';

const CUSTOMER_FILES = [
  'customer-wide/.agents/daemons/pr-review/DAEMON.md',
  'roles/pr-autopilot.yaml',
] as const;

const CUSTOMER_DIRECTORIES = [
  'customer-wide',
  'customer-wide/.agents',
  'customer-wide/.agents/daemons',
  'customer-wide/.agents/daemons/pr-review',
  'roles',
] as const;

const SOURCE_REPOSITORY_FILES = [
  'customer-wide/catalog/repositories.yaml',
  'DIRECTORIES',
] as const;

const SOURCE_REPOSITORY_DIRECTORIES = [
  'customer-wide',
  'customer-wide/catalog',
] as const;

const SOURCE_REPOSITORY_ROOTS = [
  'repo-specific',
  'repo-specific/__owner__',
  'repo-specific/__owner__/__name__',
  'repo-specific/__owner__/__name__/catalog',
  'repo-specific/__owner__/__name__/docs',
  'repo-specific/__owner__/__name__/.agents',
  'repo-specific/__owner__/__name__/.agents/daemons',
  'repo-specific/__owner__/__name__/.agents/skills',
] as const;

test('keeps the customer scaffold to the selected Role and Daemon contract', async () => {
  const snapshot = await scaffoldSnapshot(CUSTOMER_SCAFFOLD_ROOT);

  expect(snapshot.files).toEqual([...CUSTOMER_FILES]);
  expect(snapshot.directories).toEqual([...CUSTOMER_DIRECTORIES]);
  expect(snapshot.other).toEqual([]);
  expect(snapshot.files).not.toContain('README.md');
  expect(snapshot.files).not.toContain('customer-wide/catalog/entities.yaml');
  expect(snapshot.files).not.toContain(
    'customer-wide/.agents/skills/placeholder/SKILL.md'
  );
});

test('keeps the source-repository scaffold to one Repository entity and explicit roots', async () => {
  const snapshot = await scaffoldSnapshot(SOURCE_REPOSITORY_SCAFFOLD_ROOT);

  expect(snapshot.files).toEqual([...SOURCE_REPOSITORY_FILES]);
  expect(snapshot.directories).toEqual([...SOURCE_REPOSITORY_DIRECTORIES]);
  expect(snapshot.other).toEqual([]);
  expect(await readScaffoldFile('source-repo', 'DIRECTORIES')).toBe(
    `${SOURCE_REPOSITORY_ROOTS.join('\n')}\n`
  );
  expect(snapshot.files).not.toContain('customer-wide/docs/placeholder.md');
  expect(snapshot.files).not.toContain(
    'repo-specific/__owner__/__name__/catalog/placeholder.yaml'
  );
});

test('production Role scaffold parses as the current Role contract', async () => {
  const roleContents = await readScaffoldFile(
    'customer',
    'roles/pr-autopilot.yaml'
  );
  const role = parseRoleArtifact(
    artifactInput('role', 'roles/pr-autopilot.yaml', roleContents, {
      kind: 'roles',
    })
  );
  expect(role).toMatchObject({
    artifacts: [
      {
        kind: 'role',
        objective:
          'Move pull requests toward human-ready or merge-ready outcomes with less human input.',
        roleId: 'pr-autopilot',
        schemaVersion: 'role.v0',
      },
    ],
    kind: 'parsed',
    problems: [],
  });
});

test('production Daemon scaffold parses as the current Daemon contract', async () => {
  const daemonPath = 'customer-wide/.agents/daemons/pr-review/DAEMON.md';
  const daemon = parseDaemonArtifact(
    artifactInput(
      'daemon',
      daemonPath,
      await readScaffoldFile('customer', daemonPath),
      { kind: 'customer-wide' }
    )
  );
  expect(daemon).toMatchObject({
    artifacts: [
      {
        daemonId: 'pr-review',
        kind: 'daemon',
        role: 'pr-autopilot',
        schemaVersion: 'daemon.v0',
      },
    ],
    kind: 'parsed',
    problems: [],
  });
});

test('production Repository scaffold parses as the current Catalog contract', async () => {
  const catalogPath = 'customer-wide/catalog/repositories.yaml';
  const catalog = parseCatalogArtifact(
    artifactInput(
      'catalog',
      catalogPath,
      await readScaffoldFile('source-repo', catalogPath)
    )
  );
  expect(catalog).toMatchObject({
    artifacts: [
      {
        annotations: { 'charlie.ai/review-every': '90d' },
        entityKind: 'Repository',
        kind: 'catalog',
        name: '__repository_id__',
        title: '__repository_id__',
      },
    ],
    kind: 'parsed',
    problems: [],
  });
});

async function readScaffoldFile(
  scaffold: 'customer' | 'source-repo',
  relativePath: string
): Promise<string> {
  const root =
    scaffold === 'customer'
      ? CUSTOMER_SCAFFOLD_ROOT
      : SOURCE_REPOSITORY_SCAFFOLD_ROOT;
  return readFile(path.join(root, relativePath), 'utf8');
}

async function scaffoldSnapshot(root: string): Promise<
  Readonly<{
    readonly directories: readonly string[];
    readonly files: readonly string[];
    readonly other: readonly string[];
  }>
> {
  const entries = await walk(root, root);
  const directories = sortedPaths(
    entries
      .filter((entry) => entry.kind === 'directory')
      .map((entry) => entry.path)
  );
  const files = sortedPaths(
    entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path)
  );
  const other = sortedPaths(
    entries.filter((entry) => entry.kind === 'other').map((entry) => entry.path)
  );
  return { directories, files, other };
}

async function walk(
  root: string,
  directory: string
): Promise<readonly SnapshotEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join('/');
      const current: SnapshotEntry = entry.isDirectory()
        ? { kind: 'directory', path: relativePath }
        : { kind: entry.isFile() ? 'file' : 'other', path: relativePath };
      const descendants = entry.isDirectory()
        ? await walk(root, absolutePath)
        : [];
      return { current, descendants };
    })
  );
  const snapshots: SnapshotEntry[] = [];
  for (const group of groups) {
    snapshots.push(group.current, ...group.descendants);
  }
  return snapshots;
}

type EntryKind = 'directory' | 'file' | 'other';
type SnapshotEntry = Readonly<{
  readonly kind: EntryKind;
  readonly path: string;
}>;

function sortedPaths(paths: readonly string[]): string[] {
  const sorted: string[] = [];
  for (const candidatePath of paths) {
    const index = sorted.findIndex(
      (candidate) => candidate.localeCompare(candidatePath) > 0
    );
    if (index < 0) {
      sorted.push(candidatePath);
    } else {
      sorted.splice(index, 0, candidatePath);
    }
  }
  return sorted;
}
