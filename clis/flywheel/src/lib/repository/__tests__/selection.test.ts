import { describe, expect, test } from 'bun:test';

import type { RepositoryInventory } from '../contract.js';
import {
  RepositoryIdentityError,
  RepositorySelectionError,
} from '../errors.js';
import {
  createRepositorySelection,
  resolveSelectedRepositoryIds,
} from '../selection.js';

const inventory = {
  directories: [],
  entries: [],
  repositories: ['acme/api', 'beta/web'],
  state: { kind: 'working-tree', repositoryPath: '/knowledge' },
} satisfies RepositoryInventory;

describe('Flywheel repository selection construction', () => {
  test('represents the three supported selection forms explicitly', () => {
    expect(
      createRepositorySelection({
        customerWideOnly: false,
        repositoryIds: [],
      })
    ).toEqual({ kind: 'customer-wide-and-all-repositories' });
    expect(
      createRepositorySelection({
        customerWideOnly: true,
        repositoryIds: [],
      })
    ).toEqual({ kind: 'customer-wide-only' });
    expect(
      createRepositorySelection({
        customerWideOnly: false,
        repositoryIds: [' beta/web ', 'acme/api', 'beta/web'],
      })
    ).toEqual({
      kind: 'customer-wide-and-repositories',
      repositories: ['acme/api', 'beta/web'],
    });
  });

  test('rejects conflicting or malformed selection input', () => {
    expect(() =>
      createRepositorySelection({
        customerWideOnly: true,
        repositoryIds: ['acme/api'],
      })
    ).toThrow(RepositorySelectionError);
    expect(() =>
      createRepositorySelection({
        customerWideOnly: false,
        repositoryIds: ['../api'],
      })
    ).toThrow(RepositoryIdentityError);
  });
});

describe('Flywheel repository selection resolution', () => {
  test('resolves all, customer-wide-only, and known named repositories', () => {
    expect(
      resolveSelectedRepositoryIds(
        { kind: 'customer-wide-and-all-repositories' },
        inventory
      )
    ).toEqual(['acme/api', 'beta/web']);
    expect(
      resolveSelectedRepositoryIds({ kind: 'customer-wide-only' }, inventory)
    ).toEqual([]);
    expect(
      resolveSelectedRepositoryIds(
        {
          kind: 'customer-wide-and-repositories',
          repositories: ['beta/web'],
        },
        inventory
      )
    ).toEqual(['beta/web']);
  });

  test('rejects a named repository not present in the inventory', () => {
    expect(() =>
      resolveSelectedRepositoryIds(
        {
          kind: 'customer-wide-and-repositories',
          repositories: ['missing/repository'],
        },
        inventory
      )
    ).toThrow(
      'selected Flywheel repository does not exist: missing/repository'
    );
  });
});
