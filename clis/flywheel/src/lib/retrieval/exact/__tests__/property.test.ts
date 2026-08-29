import { expect, test } from 'bun:test';

import { exactSearchArgsArbitrary } from '../../../__tests__/arbitraries.js';
import {
  assert,
  fc,
  fastCheckParameters,
} from '../../../__tests__/fast-check.js';
import { runExactSearch } from '../execute.js';
import { planExactSearch } from '../plan.js';
import { policyArguments, repositoryInventory } from './test-utils.js';

test('accepted exact-search arguments remain deterministic, scoped, and policy-enforced', () => {
  const inventory = repositoryInventory();
  const baseline = planExactSearch(
    inventory,
    { kind: 'customer-wide-and-all-repositories' },
    ['incident']
  );
  const scope = {
    directories: baseline.searchPaths.filter((path) => !path.includes('.yaml')),
    files: baseline.searchPaths.filter((path) => path.includes('.yaml')),
    searchPaths: baseline.searchPaths,
    symbolicLinks: ['customer-wide/docs/linked'],
  };
  assert(
    fc.property(exactSearchArgsArbitrary(scope), (rgArgs) => {
      const first = planExactSearch(
        inventory,
        { kind: 'customer-wide-and-all-repositories' },
        rgArgs
      );
      const second = planExactSearch(
        inventory,
        { kind: 'customer-wide-and-all-repositories' },
        rgArgs
      );

      expect(first).toEqual(second);
      expect(first.searchPaths).toEqual(baseline.searchPaths);
      for (const policy of policyArguments) {
        expect(
          first.rgArgs.filter((argument) => argument === policy)
        ).toHaveLength(1);
      }
      expect(first.rgArgs).not.toContain('--follow');
      expect(first.rgArgs).not.toContain('--pre');
      expect(first.rgArgs).not.toContain('-z');
    }),
    fastCheckParameters
  );
});

test('generated escapes and helper-command arguments are rejected before execution', () => {
  const unsafe = fc.constantFrom(
    '../outside',
    '/outside',
    'customer-wide/docs/AGENTS.md',
    'customer-wide/docs/.agents/rules/security.md',
    '--follow',
    '--pre=cat',
    '--hostname-bin=hostname',
    '-z',
    '--search-zip',
    '-f',
    '--file=patterns'
  );
  assert(
    fc.property(unsafe, (argument) => {
      expect(() =>
        planExactSearch(
          repositoryInventory(),
          { kind: 'customer-wide-and-all-repositories' },
          ['incident', argument]
        )
      ).toThrow();
    }),
    fastCheckParameters
  );
});

test('empty exact-search scopes return no matches without invoking helpers', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/u),
      async (pattern) => {
        let started = false;
        const result = await runExactSearch({
          inventory: {
            directories: [],
            entries: [],
            repositories: [],
            state: { kind: 'working-tree', repositoryPath: '/knowledge' },
          },
          process: {
            run: () => {
              started = true;
              return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
            },
          },
          rgArgs: [pattern],
          selection: { kind: 'customer-wide-and-all-repositories' },
        });

        expect(result).toEqual({ exitCode: 1, stderr: '', stdout: '' });
        expect(started).toBe(false);
      }
    ),
    fastCheckParameters
  );
});
