import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CUSTOMER_SCAFFOLD_ROOT,
  SOURCE_REPOSITORY_SCAFFOLD_ROOT,
} from '../roots.js';

const CUSTOMER_DIRECTORIES = [
  '.flywheel',
  'customer-wide',
  'customer-wide/catalog',
  'customer-wide/docs',
  'customer-wide/.agents',
  'customer-wide/.agents/daemons',
  'customer-wide/.agents/daemons/pr-review',
  'customer-wide/.agents/skills',
  'roles',
] as const;

const SOURCE_REPOSITORY_DIRECTORIES = [
  '.flywheel',
  'customer-wide',
  'customer-wide/catalog',
  'customer-wide/docs',
  'customer-wide/.agents',
  'customer-wide/.agents/daemons',
  'customer-wide/.agents/skills',
  'repo-specific',
  'repo-specific/__owner__',
  'repo-specific/__owner__/__name__',
  'repo-specific/__owner__/__name__/catalog',
  'repo-specific/__owner__/__name__/docs',
  'repo-specific/__owner__/__name__/.agents',
  'repo-specific/__owner__/__name__/.agents/daemons',
  'repo-specific/__owner__/__name__/.agents/skills',
] as const;

const CUSTOMER_MARKERS = [
  '.flywheel/.gitkeep',
  'customer-wide/.agents/daemons/pr-review/.gitkeep',
  'customer-wide/.agents/skills/.gitkeep',
  'customer-wide/catalog/.gitkeep',
  'customer-wide/docs/.gitkeep',
  'roles/.gitkeep',
] as const;

const SOURCE_REPOSITORY_MARKERS = [
  '.flywheel/.gitkeep',
  'customer-wide/.agents/daemons/.gitkeep',
  'customer-wide/.agents/skills/.gitkeep',
  'customer-wide/catalog/.gitkeep',
  'customer-wide/docs/.gitkeep',
  'repo-specific/__owner__/__name__/.agents/daemons/.gitkeep',
  'repo-specific/__owner__/__name__/.agents/skills/.gitkeep',
  'repo-specific/__owner__/__name__/catalog/.gitkeep',
  'repo-specific/__owner__/__name__/docs/.gitkeep',
] as const;

test('keeps the customer scaffold directories and Git markers', async () => {
  const snapshot = await scaffoldSnapshot(CUSTOMER_SCAFFOLD_ROOT);

  expect(snapshot.files).toEqual(
    sortedPaths(['DIRECTORIES', ...CUSTOMER_MARKERS])
  );
  expect(snapshot.directories).toEqual(sortedPaths(CUSTOMER_DIRECTORIES));
  expect(snapshot.other).toEqual([]);
  expect(await readScaffoldFile('customer', 'DIRECTORIES')).toBe(
    `${CUSTOMER_DIRECTORIES.join('\n')}\n`
  );
  expect(snapshot.files).not.toContain(
    'customer-wide/.agents/daemons/pr-review/DAEMON.md'
  );
  expect(snapshot.files).not.toContain('roles/pr-autopilot.yaml');
  await expectEmptyMarkers(CUSTOMER_SCAFFOLD_ROOT, CUSTOMER_MARKERS);
});

test('keeps the source-repository scaffold directories and Git markers', async () => {
  const snapshot = await scaffoldSnapshot(SOURCE_REPOSITORY_SCAFFOLD_ROOT);

  expect(snapshot.files).toEqual(
    sortedPaths(['DIRECTORIES', ...SOURCE_REPOSITORY_MARKERS])
  );
  expect(snapshot.directories).toEqual(
    sortedPaths(SOURCE_REPOSITORY_DIRECTORIES)
  );
  expect(snapshot.other).toEqual([]);
  expect(await readScaffoldFile('source-repo', 'DIRECTORIES')).toBe(
    `${SOURCE_REPOSITORY_DIRECTORIES.join('\n')}\n`
  );
  expect(snapshot.files).not.toContain(
    'customer-wide/catalog/repositories.yaml'
  );
  await expectEmptyMarkers(
    SOURCE_REPOSITORY_SCAFFOLD_ROOT,
    SOURCE_REPOSITORY_MARKERS
  );
});

async function expectEmptyMarkers(
  root: string,
  relativePaths: readonly string[]
): Promise<void> {
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      expect(await readScaffoldFileAt(root, relativePath)).toBe('');
    })
  );
}

async function readScaffoldFileAt(
  root: string,
  relativePath: string
): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8');
}

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
