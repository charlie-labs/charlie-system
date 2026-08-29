import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import { type Sdk } from '../../../../generated/linear-sdk.js';
import DocumentView from '../view.js';

function makeSdkStub(doc: Record<string, unknown>) {
  const sdk: Pick<Sdk, 'GetDocument'> = {
    async GetDocument() {
      return { document: doc } as Awaited<ReturnType<Sdk['GetDocument']>>;
    },
  };
  return sdk;
}

test('document view returns raw document when --json is used', async () => {
  // Use `any` to avoid structural-compatibility complaints against the mocked SDK
  const doc: any = {
    __typename: 'Document',
    id: '1111',
    slugId: 'DOC-1',
    title: 'Test doc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    project: { __typename: 'Project', id: 'proj-1', name: 'Proj' },
    creator: {
      __typename: 'User',
      id: 'user-1',
      displayName: 'Alice',
      name: 'Alice',
    },
    content: '# Hello',
  };

  const client = makeSdkStub(doc);

  const config = await Config.load();
  DocumentView.setTestDeps({ client });
  const cmd = new DocumentView(['DOC-1', '--json'], config);
  const result = await cmd.run();

  expect(result).toEqual(doc);
});

test('document view prints details including content in human-readable mode', async () => {
  // Use `any` to avoid structural-compatibility complaints against the mocked SDK
  const doc: any = {
    __typename: 'Document',
    id: '2222',
    slugId: 'DOC-2',
    title: 'Printable doc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    project: null,
    creator: null,
    content: '# Printed content\n\nSome **markdown** body.',
  };

  const client = makeSdkStub(doc);

  const config = await Config.load();
  DocumentView.setTestDeps({ client });
  const cmd = new DocumentView(['DOC-2'], config);
  const printed: string[] = [];
  const originalLog = cmd.log;
  cmd.log = (...args: unknown[]) => {
    if (args.length === 0) return;
    printed.push(String(args[0]));
  };

  try {
    await cmd.run();
  } finally {
    cmd.log = originalLog;
  }

  const combined = printed.join('\n');
  expect(combined).toContain('DOC-2');
  expect(combined).toContain('Content:');
  expect(combined).toContain('# Printed content');
});
