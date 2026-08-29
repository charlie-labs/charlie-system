import { afterEach, expect, test } from 'bun:test';

import Show from '../commands/content/show.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('registers content show as a typed artifact inspection command', () => {
  expect(Show.summary).toBe('Show one compiled Flywheel artifact');
});

test('renders only the selected document section in human mode', async () => {
  const repositoryPath = await makeShowRepository();
  const result = await runCli([
    'content',
    'show',
    'customer-wide/docs/guide.md#operate',
    '--repository-path',
    repositoryPath,
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain(
    'target document-section:customer-wide%2Fdocs%2Fguide.md#operate'
  );
  expect(result.stdout).toContain('## Operate');
  expect(result.stdout).toContain('Operate safely.');
  expect(result.stdout).not.toContain('Overview only.');
});

test('returns the normalized artifact boundary in JSON mode', async () => {
  const repositoryPath = await makeShowRepository();
  const result = await runCli([
    'content',
    'show',
    'component:api',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    artifact: {
      kind: 'catalog',
      name: 'api',
      spec: { owner: 'group:default/platform' },
    },
    kind: 'artifact',
    target: { kind: 'catalog', namespace: 'default' },
  });
});

test('accepts content show flags before the target', async () => {
  const repositoryPath = await makeShowRepository();
  const result = await runCli([
    'content',
    'show',
    '--repository-path',
    repositoryPath,
    '--json',
    'component:api',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    artifact: { kind: 'catalog', name: 'api' },
    kind: 'artifact',
  });
});

test('never renders or returns secret-bearing authored URLs', async () => {
  const secret = 'SHOW-SECRET-VALUE';
  const repositoryPath = await makeRepository({
    'customer-wide/docs/secret.md': `---\npurpose: Explain safety.\nreviewEvery: 30d\n---\n# Safety\n\n[private](https://example.test/run?access_token=${secret})\n`,
  });
  const results = await Promise.all(
    [[], ['--json']].map((mode) =>
      runCli([
        'content',
        'show',
        'customer-wide/docs/secret.md',
        '--repository-path',
        repositoryPath,
        ...mode,
      ])
    )
  );

  expect(results.map((result) => result.exitCode)).toEqual([2, 1]);
  for (const result of results) {
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    expect(`${result.stdout}${result.stderr}`).not.toContain('access_token');
    expect(`${result.stdout}${result.stderr}`).toContain(
      'authored URL contains secret-bearing credentials'
    );
  }
  expect(JSON.parse(results[1]?.stdout ?? '')).toMatchObject({
    error: {
      inspection: {
        kind: 'unparsed',
        problems: [{ code: 'ARTIFACT_REFERENCE_SECRET' }],
      },
    },
  });
});

test('keeps unparsed, ambiguous, missing, and external outcomes explicit', async () => {
  const repositoryPath = await makeShowRepository();
  const inputs: readonly Readonly<{
    readonly exitCode: number;
    readonly kind: string;
    readonly target: string;
  }>[] = [
    {
      exitCode: 1,
      kind: 'unparsed',
      target: 'customer-wide/docs/broken.md',
    },
    { exitCode: 2, kind: 'ambiguous', target: 'reviewer' },
    {
      exitCode: 1,
      kind: 'missing',
      target: 'customer-wide/docs/missing.md',
    },
    {
      exitCode: 2,
      kind: 'not-inspectable',
      target: 'linear:BOT-12915',
    },
  ];
  const results = await Promise.all(
    inputs.map((input) =>
      runCli([
        'content',
        'show',
        input.target,
        '--repository-path',
        repositoryPath,
        '--json',
      ])
    )
  );

  for (const [index, expected] of inputs.entries()) {
    const result = results[index];
    expect(result?.exitCode).toBe(expected.exitCode);
    expect(result?.stderr).toBe('');
    expect(JSON.parse(result?.stdout ?? '')).toMatchObject({
      error: {
        inspection: { kind: expected.kind },
        type: 'ContentShowError',
      },
    });
  }
});

async function makeShowRepository(): Promise<string> {
  return makeRepository({
    'customer-wide/.agents/daemons/reviewer/DAEMON.md': daemon(),
    'customer-wide/.agents/skills/reviewer/SKILL.md': skill(),
    'customer-wide/catalog/api.yaml': catalog(),
    'customer-wide/docs/broken.md': '# Missing metadata\n',
    'customer-wide/docs/guide.md': document(),
  });
}

function document(): string {
  return `---
purpose: Explain operations.
reviewEvery: 90d
---
# Guide

## Overview

Overview only.

## Operate

Operate safely.
`;
}

function catalog(): string {
  return `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api
spec:
  owner: group:default/platform
`;
}

function daemon(): string {
  return `---
id: reviewer
purpose: Review changes.
role: reviewer
watch: A change is ready.
routines: Review the change.
---
# Reviewer

Review the change.
`;
}

function skill(): string {
  return `---
name: reviewer
description: Review a change when evidence is available.
---
# Review

Review the change.
`;
}
