import { expect, test } from 'bun:test';

import { governedPathArbitrary } from '../../__tests__/arbitraries.js';
import { assert, fc, fastCheckParameters } from '../../__tests__/fast-check.js';
import { classifyRepositoryEntry } from '../classify.js';
import type { RepositorySourceEntry } from '../contract.js';
import { discoverRepository } from '../discover.js';
import { sortedCopy } from '../ordering.js';
import {
  normalizeRepositoryRelativePath,
  resolveRepositoryEntryPath,
  toRepositoryRelativePath,
} from '../path.js';
import {
  createRepositorySelection,
  resolveSelectedRepositoryIds,
} from '../selection.js';
import { representativeClassificationCases } from './classification-cases.js';

function compareRepositoryStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

test('governed Flywheel repository paths normalize deterministically and idempotently', () => {
  assert(
    fc.property(governedPathArbitrary, (candidate) => {
      const normalized = normalizeRepositoryRelativePath(candidate);
      expect(normalizeRepositoryRelativePath(normalized)).toBe(normalized);
      expect(
        toRepositoryRelativePath(
          '/knowledge',
          resolveRepositoryEntryPath('/knowledge', normalized)
        )
      ).toBe(normalized);
    }),
    fastCheckParameters
  );
});

test('representative repository classification semantics are explicit', () => {
  assert(
    fc.property(
      fc.constantFrom(...representativeClassificationCases),
      (item) => {
        expect(
          classifyRepositoryEntry(item.source, new Set(item.repositories))
        ).toEqual(item.expected);
      }
    ),
    fastCheckParameters
  );
});

test('Flywheel repository discovery is independent of source entry order', async () => {
  const entries: readonly RepositorySourceEntry[] = [
    { kind: 'directory', path: 'repo-specific/acme/api' },
    { kind: 'directory', path: 'customer-wide/docs' },
    { kind: 'file', path: 'customer-wide/docs/guide.md' },
    { kind: 'file', path: 'roles/release-manager.yaml' },
    { kind: 'file', path: 'README.md' },
  ];
  await fc.assert(
    fc.asyncProperty(
      fc.shuffledSubarray([...entries], {
        minLength: entries.length,
        maxLength: entries.length,
      }),
      async (shuffled) => {
        let listCalls = 0;
        const inventory = await discoverRepository({
          listEntries: () => {
            listCalls += 1;
            return Promise.resolve(shuffled);
          },
          readFiles: () => Promise.resolve([]),
          state: { kind: 'working-tree', repositoryPath: '/knowledge' },
        });

        expect(listCalls).toBe(1);
        expect(inventory.repositories).toEqual(['acme/api']);
        expect(inventory.entries.map((entry) => entry.path)).toEqual([
          ...sortedCopy(
            [...shuffled]
              .filter((entry) => entry.kind !== 'directory')
              .map((entry) => entry.path),
            compareRepositoryStrings
          ),
        ]);
      }
    ),
    fastCheckParameters
  );
});

test('Flywheel repository selections normalize, deduplicate, and resolve only known repo-specific regions', () => {
  assert(
    fc.property(
      fc.array(
        fc.constantFrom('acme/api', ' beta/web ', 'acme/api ', 'beta/web'),
        { minLength: 1, maxLength: 8 }
      ),
      (repositoryIds) => {
        const selection = createRepositorySelection({
          customerWideOnly: false,
          repositoryIds,
        });
        expect(selection.kind).toBe('customer-wide-and-repositories');
        if (selection.kind !== 'customer-wide-and-repositories') return;
        expect(selection.repositories).toEqual(
          sortedCopy(
            [
              ...new Set(
                repositoryIds.map((repositoryId) => repositoryId.trim())
              ),
            ],
            compareRepositoryStrings
          )
        );
        expect(
          resolveSelectedRepositoryIds(selection, {
            directories: [],
            entries: [],
            repositories: ['acme/api', 'beta/web'],
            state: { kind: 'working-tree', repositoryPath: '/knowledge' },
          })
        ).toEqual(selection.repositories);
      }
    ),
    fastCheckParameters
  );
});
