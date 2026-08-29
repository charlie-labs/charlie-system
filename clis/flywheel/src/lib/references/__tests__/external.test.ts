import { expect, test } from 'bun:test';

import { parseExternalReference } from '../external.js';

test('parses supported GitHub identity forms offline', () => {
  expect(
    parseExternalReference('https://github.com/Charlie-Labs/System/issues/10')
  ).toEqual({
    kind: 'target',
    target: {
      identifier: '10',
      kind: 'github',
      repository: 'charlie-labs/system',
      resource: 'issue',
    },
  });
  expect(
    parseExternalReference('https://github.com/acme/api/pull/7#discussion')
  ).toMatchObject({
    target: { identifier: '7', kind: 'github', resource: 'pull-request' },
  });
  expect(
    parseExternalReference(
      'https://github.com/acme/api/commit/0123456789abcdef'
    )
  ).toMatchObject({
    target: {
      identifier: '0123456789abcdef',
      kind: 'github',
      resource: 'commit',
    },
  });
  expect(
    parseExternalReference(
      'https://github.com/acme/api/blob/main/src/index.ts#L10-L12'
    )
  ).toEqual({
    kind: 'target',
    target: {
      kind: 'source-repository-file',
      path: 'src/index.ts',
      repository: 'acme/api',
      revision: 'main',
      selector: 'L10-L12',
    },
  });
});

test('parses supported Linear and Slack identity forms offline', () => {
  expect(
    parseExternalReference(
      'https://linear.app/charlie-labs/issue/bot-12916/relationship-graph'
    )
  ).toEqual({
    kind: 'target',
    target: { issueId: 'BOT-12916', kind: 'linear' },
  });
  expect(
    parseExternalReference(
      'https://acme.slack.com/archives/C123ABC/p1724861234567890'
    )
  ).toEqual({
    kind: 'target',
    target: {
      channelId: 'C123ABC',
      kind: 'slack',
      messageTs: '1724861234.567890',
    },
  });
});

test('parses Task, transcript, and generic Web identities offline', () => {
  expect(parseExternalReference('/tasks/task_123')).toEqual({
    kind: 'target',
    target: { kind: 'task', taskId: 'task_123' },
  });
  expect(parseExternalReference('/tasks/task_123#seq-8')).toEqual({
    kind: 'target',
    target: { kind: 'transcript-item', sequence: 8, taskId: 'task_123' },
  });
  expect(
    parseExternalReference('https://example.com/path?q=1#section')
  ).toEqual({
    kind: 'target',
    target: { kind: 'web', url: 'https://example.com/path?q=1#section' },
  });
});

test('does not guess malformed or unsupported references into identities', () => {
  expect(parseExternalReference('https://[')).toEqual({ kind: 'invalid' });
  expect(parseExternalReference('/tasks/no spaces')).toEqual({
    kind: 'invalid',
  });
  expect(parseExternalReference('file:///tmp/source')).toEqual({
    kind: 'unsupported',
  });
  expect(parseExternalReference('component:default/api')).toEqual({
    kind: 'not-external',
  });
});

test('rejects secret-bearing URLs before constructing external identities', () => {
  const secret = 'EXTERNAL-SECRET-VALUE';
  const inputs = [
    `https://example.test/run?access_token=${secret}`,
    `https://github.com/acme/api?api_key=${secret}`,
    `https://user:${secret}@linear.app/acme/issue/BOT-42/x`,
  ];

  for (const input of inputs) {
    const result = parseExternalReference(input);
    expect(result).toEqual({ kind: 'invalid' });
    expect(JSON.stringify(result)).not.toContain(secret);
  }
});
