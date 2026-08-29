import { expect, test } from 'bun:test';

import type {
  RepositoryEntry,
  RepositoryInventory,
  RepositorySource,
  RepositorySourceEntry,
} from '../contract.js';
import { discoverRepository } from '../discover.js';

test('lists once, does not read content, and discovers repository regions', async () => {
  const { calls, inventory, source } = await discoverFixture();

  expect(calls).toEqual({ list: 1, read: 0 });
  expect(inventory.state).toEqual(source.state);
  expect(inventory.repositories).toEqual(['acme/api', 'beta/empty']);
  expect(inventory.directories).toEqual([
    'repo-specific/acme/api',
    'repo-specific/beta/empty',
    'repo-specific/not valid/repository',
  ]);
});

test('classifies artifacts and their structurally owned support', async () => {
  const { inventory } = await discoverFixture();

  expectEntry(inventory, 'core/.agents/daemons/base/DAEMON.md', {
    artifactKind: 'daemon',
    kind: 'artifact',
    region: { kind: 'core' },
  });
  expectEntry(inventory, 'core/.agents/daemons/base/run.ts', {
    artifactKind: 'daemon',
    kind: 'support-file',
    owner: 'core/.agents/daemons/base/DAEMON.md',
    region: { kind: 'core' },
  });
  expectEntry(inventory, 'customer-wide/docs/guide.md', {
    artifactKind: 'document',
    kind: 'artifact',
    region: { kind: 'customer-wide' },
  });
  expectEntry(inventory, 'customer-wide/docs/diagram.png', {
    artifactKind: 'document',
    kind: 'support-file',
    region: { kind: 'customer-wide' },
  });
  expectEntry(inventory, 'customer-wide/catalog/services/api.yaml', {
    artifactKind: 'catalog',
    kind: 'artifact',
  });
  expectEntry(inventory, 'customer-wide/.agents/daemons/ops/DAEMON.md', {
    artifactKind: 'daemon',
    kind: 'artifact',
  });
  expectEntry(inventory, 'customer-wide/.agents/skills/reviewer/SKILL.md', {
    artifactKind: 'skill',
    kind: 'artifact',
  });
});

test('attaches repository-specific and Role regions during classification', async () => {
  const { inventory } = await discoverFixture();

  expectEntry(inventory, 'repo-specific/acme/api/docs/readme.markdown', {
    artifactKind: 'document',
    kind: 'artifact',
    region: { kind: 'repository-specific', repository: 'acme/api' },
  });
  expectEntry(inventory, 'roles/engineer.yml', {
    artifactKind: 'role',
    kind: 'artifact',
    region: { kind: 'roles' },
  });
});

test('keeps tooling, prohibited, and unsupported entries visible', async () => {
  const { inventory } = await discoverFixture();

  expectEntry(inventory, '.flywheel/reviews.yaml', {
    kind: 'tooling-state',
    toolingKind: 'review-manifest',
  });
  expectEntry(inventory, '.flywheel/index.sqlite', {
    kind: 'tooling-state',
    toolingKind: 'derived',
  });
  expectEntry(inventory, 'customer-wide/AGENTS.md', {
    kind: 'prohibited',
    rule: 'rules-are-not-flywheel-content',
  });
  expectEntry(inventory, 'customer-wide/.agents/rules/security.md', {
    kind: 'prohibited',
  });
  expectEntry(inventory, 'core/.agents/skills/not-allowed/SKILL.md', {
    kind: 'unsupported',
    reason: 'unsupported-location',
    region: { kind: 'core' },
  });
  expectEntry(inventory, 'customer-wide/catalog/readme.txt', {
    kind: 'unsupported',
    reason: 'unsupported-file-type',
  });
  expectEntry(inventory, 'customer-wide/.agents/skills/loose.md', {
    kind: 'unsupported',
    reason: 'unsupported-location',
  });
  expectEntry(inventory, 'repo-specific/missing/repo/docs/ghost.md', {
    kind: 'unsupported',
    reason: 'unsupported-location',
    region: undefined,
  });
  expectEntry(inventory, 'roles/nested/engineer.yaml', {
    kind: 'unsupported',
    reason: 'unsupported-file-type',
  });
  expectEntry(inventory, 'README.md', {
    kind: 'unsupported',
    region: undefined,
  });
  expectEntry(inventory, 'customer-wide/docs/linked', {
    kind: 'unsupported',
    reason: 'symbolic-link',
  });
  expectEntry(inventory, 'customer-wide/docs/socket', {
    kind: 'unsupported',
    reason: 'special-file',
  });
});

async function discoverFixture(): Promise<
  Readonly<{
    calls: { list: number; read: number };
    inventory: RepositoryInventory;
    source: RepositorySource;
  }>
> {
  const calls = { list: 0, read: 0 };
  const source = sourceFor(calls, fixtureEntries());
  return { calls, inventory: await discoverRepository(source), source };
}

function fixtureEntries(): readonly RepositorySourceEntry[] {
  return [
    directory('repo-specific/beta/empty'),
    directory('repo-specific/acme/api'),
    directory('repo-specific/not valid/repository'),
    file('core/.agents/daemons/base/DAEMON.md'),
    file('core/.agents/daemons/base/run.ts'),
    file('core/.agents/skills/not-allowed/SKILL.md'),
    file('customer-wide/docs/guide.md'),
    file('customer-wide/docs/diagram.png'),
    file('customer-wide/catalog/services/api.yaml'),
    file('customer-wide/catalog/readme.txt'),
    file('customer-wide/.agents/daemons/ops/DAEMON.md'),
    file('customer-wide/.agents/skills/reviewer/SKILL.md'),
    file('customer-wide/.agents/skills/loose.md'),
    file('repo-specific/acme/api/docs/readme.markdown'),
    file('repo-specific/missing/repo/docs/ghost.md'),
    file('roles/engineer.yml'),
    file('roles/nested/engineer.yaml'),
    file('.flywheel/reviews.yaml'),
    file('.flywheel/index.sqlite'),
    file('customer-wide/AGENTS.md'),
    file('customer-wide/.agents/rules/security.md'),
    file('README.md'),
    symbolicLink('customer-wide/docs/linked'),
    other('customer-wide/docs/socket'),
  ];
}

function sourceFor(
  calls: { list: number; read: number },
  entries: readonly RepositorySourceEntry[]
): RepositorySource {
  return {
    state: { kind: 'working-tree', repositoryPath: '/knowledge' },
    listEntries: () => {
      calls.list += 1;
      return Promise.resolve(entries);
    },
    readFiles: () => {
      calls.read += 1;
      return Promise.resolve([]);
    },
  };
}

function expectEntry(
  inventory: RepositoryInventory,
  path: string,
  expected: Readonly<Record<string, unknown>>
): void {
  expect(entryAt(inventory.entries, path)).toMatchObject(expected);
}

function entryAt(
  entries: readonly RepositoryEntry[],
  path: string
): RepositoryEntry | undefined {
  return entries.find((entry) => entry.path === path);
}

function directory(path: string): RepositorySourceEntry {
  return { kind: 'directory', path };
}

function file(path: string): RepositorySourceEntry {
  return { kind: 'file', path };
}

function symbolicLink(path: string): RepositorySourceEntry {
  return { kind: 'symbolic-link', path };
}

function other(path: string): RepositorySourceEntry {
  return { kind: 'other', path };
}
