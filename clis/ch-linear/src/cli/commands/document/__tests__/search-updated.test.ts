import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import { type Sdk } from '../../../../generated/linear-sdk.js';
import DocumentSearch from '../search.js';

function makeSdkStub(spy: (vars: any) => void) {
  const sdk: Pick<Sdk, 'SearchDocuments' | 'ListDocuments'> = {
    async SearchDocuments(vars: any) {
      spy(vars);
      return {
        searchDocuments: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as Sdk['SearchDocuments'] extends (...args: any) => infer R
        ? Awaited<R>
        : never;
    },
    async ListDocuments(vars: any) {
      spy(vars);
      return {
        documents: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      } as Sdk['ListDocuments'] extends (...args: any) => infer R
        ? Awaited<R>
        : never;
    },
  };
  return sdk;
}

test('document search appends normalized updated qualifier (<=)', async () => {
  const calls: any[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  DocumentSearch.setTestDeps({ client });
  const cmd = new DocumentSearch(
    ['architecture', '-u', '<=2025-07-04', '--json'],
    config
  );
  await cmd.run();
  expect(calls.length).toBe(1);
  expect(calls[0]!.term.includes('updated:<=2025-07-04')).toBe(true);
});

test('document search rejects invalid updated operator (exit 2, exact message)', async () => {
  const calls: any[] = [];
  const client = makeSdkStub((v) => calls.push(v));
  const config = await Config.load();
  DocumentSearch.setTestDeps({ client });
  const cmd = new DocumentSearch(
    ['arch', '-u', '==2025-01-01', '--json'],
    config
  );
  try {
    await cmd.run();
    throw new Error('should have thrown');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'Invalid operator in --updated: "==2025-01-01". Allowed operators: >, >=, <, <=, = (or none).'
    );
  }
  expect(calls.length).toBe(0);
});
