import { expect, test } from 'bun:test';

import { planExactSearch } from '../plan.js';
import { policyArguments, repositoryInventory } from './test-utils.js';

test('plans the default exact corpus from inventory and selection', () => {
  const plan = planExactSearch(
    repositoryInventory(),
    { kind: 'customer-wide-and-all-repositories' },
    ['-g', '*.md', 'incident']
  );

  expect(plan.repositoryPath).toBe('/knowledge');
  expect(plan.searchPaths).toEqual([
    'roles/analyst.yaml',
    'roles/engineer.yaml',
    'customer-wide/catalog',
    'customer-wide/docs',
    'customer-wide/.agents/daemons',
    'customer-wide/.agents/skills',
    'repo-specific/acme/api/docs',
    'repo-specific/acme/api/.agents/skills',
    'repo-specific/beta/web/docs',
  ]);
  expect(plan.rgArgs).toEqual([
    '-g',
    '*.md',
    'incident',
    ...policyArguments,
    ...plan.searchPaths,
  ]);
});

test('narrows only the repository-specific part of exact scope', () => {
  const named = planExactSearch(
    repositoryInventory(),
    {
      kind: 'customer-wide-and-repositories',
      repositories: ['beta/web'],
    },
    ['incident']
  );
  const customerWide = planExactSearch(
    repositoryInventory(),
    { kind: 'customer-wide-only' },
    ['incident']
  );

  expect(named.searchPaths).toContain('repo-specific/beta/web/docs');
  expect(named.searchPaths).not.toContain('repo-specific/acme/api/docs');
  expect(customerWide.searchPaths).not.toContain('repo-specific/beta/web/docs');
  expect(named.searchPaths).toContain('roles/analyst.yaml');
  expect(customerWide.searchPaths).toContain('customer-wide/docs');
});

test('fails named selection before planning an unknown repository', () => {
  expect(() =>
    planExactSearch(
      repositoryInventory(),
      {
        kind: 'customer-wide-and-repositories',
        repositories: ['missing/repository'],
      },
      ['incident']
    )
  ).toThrow('selected Flywheel repository does not exist: missing/repository');
});
