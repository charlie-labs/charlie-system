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

test('accepts content related flags before the target', async () => {
  const repositoryPath = await makeRelatedRepository();
  const result = await runCli([
    'content',
    'related',
    '--repository-path',
    repositoryPath,
    '--json',
    'customer-wide/docs/guide.md',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    kind: 'related',
    target: { id: 'document:customer-wide%2Fdocs%2Fguide.md' },
  });
});

test('never echoes a secret-bearing related target in human or JSON output', async () => {
  const repositoryPath = await makeRelatedRepository();
  const secret = 'RELATED-SECRET-VALUE';
  const target = `https://example.test/run?access_token=${secret}`;
  const results = await Promise.all(
    [[], ['--json']].map((mode) =>
      runCli([
        'content',
        'related',
        target,
        '--repository-path',
        repositoryPath,
        ...mode,
      ])
    )
  );

  for (const result of results) {
    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'content related target contains secret-bearing credentials'
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    expect(`${result.stdout}${result.stderr}`).not.toContain('access_token');
  }
});

test('returns retained unparsed problems in JSON and human diagnostics', async () => {
  const repositoryPath = await makeRelatedRepository();
  const unparsed = await runCli([
    'content',
    'related',
    'customer-wide/docs/broken.md',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);

  expect(unparsed.exitCode).toBe(1);
  expect(unparsed.stderr).toBe('');
  expect(JSON.parse(unparsed.stdout)).toMatchObject({
    error: {
      result: {
        kind: 'unparsed',
        problems: [{ code: 'ARTIFACT_FRONTMATTER_REQUIRED' }],
      },
      type: 'ContentRelatedError',
    },
  });
  expect(unparsed.stdout).not.toContain('problems:\n');

  const humanUnparsed = await runCli([
    'content',
    'related',
    'customer-wide/docs/broken.md',
    '--repository-path',
    repositoryPath,
  ]);
  expect(humanUnparsed.exitCode).toBe(2);
  expect(humanUnparsed.stdout).toBe('');
  expect(humanUnparsed.stderr).toContain('problems:\n');
  expect(humanUnparsed.stderr).toContain('ARTIFACT_FRONTMATTER_REQUIRED');
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
    'customer-wide/docs/broken.md': '# Missing metadata\n',
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
