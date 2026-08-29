import { expect, test } from 'bun:test';

import { planExactSearch } from '../plan.js';
import { policyArguments, repositoryInventory } from './test-utils.js';

test('normalizes admitted positional paths and preserves explicit narrowing', () => {
  const plan = exactPlan([
    '--replace',
    '$1',
    'incident',
    './customer-wide/docs/guides',
  ]);

  expect(plan.rgArgs).toEqual([
    '--replace',
    '$1',
    'incident',
    'customer-wide/docs/guides',
    ...policyArguments,
  ]);
});

test('inserts enforced policy before ripgrep own delimiter', () => {
  const plan = exactPlan(['--regexp', 'incident', '--', 'customer-wide/docs']);

  expect(plan.rgArgs).toEqual([
    '--regexp',
    'incident',
    ...policyArguments,
    '--',
    'customer-wide/docs',
  ]);
});

test('treats --files positionals as paths instead of a search pattern', () => {
  const narrowed = exactPlan(['--files', 'repo-specific/acme/api/docs']);
  const defaultScope = exactPlan(['--files']);

  expect(narrowed.rgArgs).toEqual([
    '--files',
    'repo-specific/acme/api/docs',
    ...policyArguments,
  ]);
  expect(defaultScope.rgArgs).toEqual([
    '--files',
    ...policyArguments,
    ...defaultScope.searchPaths,
  ]);
});

test('treats -e and -f values as patterns rather than path operands', () => {
  expect(() => exactPlan(['-f', 'patterns', '../outside'])).toThrow(
    'repository-relative admitted path: ../outside'
  );
  expect(() => exactPlan(['-fpatterns', '../outside'])).toThrow(
    'repository-relative admitted path: ../outside'
  );
  expect(exactPlan(['-e', '--follow']).rgArgs).toEqual([
    '-e',
    '--follow',
    ...policyArguments,
    ...exactPlan(['-e', '--follow']).searchPaths,
  ]);
});

test('rejects paths outside scope, through symlinks, or into Rules', () => {
  const rejectedPaths = [
    '../outside',
    '/outside',
    'customer-wide',
    'customer-wide/docs/linked/secret.md',
    'customer-wide/docs/AGENTS.md',
    'customer-wide/docs/.agents/rules/security.md',
  ];

  for (const rejectedPath of rejectedPaths) {
    expect(() => exactPlan(['incident', rejectedPath])).toThrow();
  }
});

test('rejects output, traversal, and command-execution modes', () => {
  for (const argument of [
    '--json',
    '--follow',
    '-L',
    '--type-list',
    '--generate=man',
    '--pre=cat',
    '--hostname-bin=hostname',
  ]) {
    expect(() => exactPlan(['incident', argument])).toThrow();
  }
});

function exactPlan(rgArgs: readonly string[]) {
  return planExactSearch(
    repositoryInventory(),
    { kind: 'customer-wide-and-all-repositories' },
    rgArgs
  );
}
