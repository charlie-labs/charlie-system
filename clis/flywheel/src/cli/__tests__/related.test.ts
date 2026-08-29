import { afterEach, expect, test } from 'bun:test';

import Related from '../commands/content/related.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('registers content related as graph traversal', () => {
  expect(Related.summary).toBe('Traverse relationships around a known target');
});

test('renders typed local and external relationships', async () => {
  const repositoryPath = await makeRelatedRepository();
  const [human, json] = await Promise.all([
    runCli([
      'content',
      'related',
      'customer-wide/docs/guide.md',
      '--repository-path',
      repositoryPath,
    ]),
    runCli([
      'content',
      'related',
      'customer-wide/docs/guide.md',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);

  expect(human.exitCode).toBe(0);
  expect(human.stderr).toBe('');
  expect(human.stdout).toContain(
    'outgoing about catalog:component%3Adefault%2Fapi'
  );
  expect(human.stdout).toContain('outgoing cites linear:BOT-42');
  expect(json.exitCode).toBe(0);
  expect(json.stderr).toBe('');
  expect(JSON.parse(json.stdout)).toMatchObject({
    kind: 'related',
    target: { id: 'document:customer-wide%2Fdocs%2Fguide.md' },
  });
});

test('returns explicit JSON failures for missing, ambiguous, and open inputs', async () => {
  const repositoryPath = await makeRelatedRepository();
  const [missing, ambiguous, external] = await Promise.all([
    runCli([
      'content',
      'related',
      'missing',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'content',
      'related',
      'customer-wide/catalog/entities.yaml',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'content',
      'related',
      'linear:BOT-42',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);

  expect(missing.exitCode).toBe(1);
  expect(missing.stderr).toBe('');
  expect(JSON.parse(missing.stdout)).toMatchObject({
    error: { result: { kind: 'missing' }, type: 'ContentRelatedError' },
  });
  expect(ambiguous.exitCode).toBe(2);
  expect(ambiguous.stderr).toBe('');
  expect(JSON.parse(ambiguous.stdout)).toMatchObject({
    error: { result: { kind: 'ambiguous' }, type: 'ContentRelatedError' },
  });
  expect(external.exitCode).toBe(2);
  expect(external.stderr).toBe('');
  expect(JSON.parse(external.stdout)).toMatchObject({
    error: {
      result: { kind: 'unsupported-target' },
      type: 'ContentRelatedError',
    },
  });
});

async function makeRelatedRepository(): Promise<string> {
  return makeRepository({
    'customer-wide/catalog/entities.yaml': catalog(),
    'customer-wide/docs/guide.md': guide(),
  });
}

function guide(): string {
  return `---
purpose: Explain the API.
reviewEvery: 90d
about: [component:default/api]
---
# Guide

## Sources

- [Tracking issue](https://linear.app/acme/issue/BOT-42/tracking)
`;
}

function catalog(): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Group
metadata:
  name: platform
spec: {}
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api
spec:
  owner: group:default/platform
`;
}
