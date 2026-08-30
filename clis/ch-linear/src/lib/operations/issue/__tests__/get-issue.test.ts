import { expect, test } from 'bun:test';

import { MemoryCacheProvider } from '../../../cache/memory-cache-provider.js';
import { NotFoundError } from '../../../errors/not-found-error.js';
import { getIssue } from '../get-issue.js';

test('getIssue returns issue and caches', async () => {
  let calls = 0;
  const client = {
    async GetIssue() {
      calls += 1;
      return { issue: { id: 'i1', identifier: 'ABC-1', title: 'Test' } } as any;
    },
  };
  const cache = new MemoryCacheProvider();
  const issue = await getIssue({ id: 'i1' }, { client, cache });
  expect(issue.id).toBe('i1');
  await getIssue({ id: 'i1' }, { client, cache });
  expect(calls).toBe(1); // cached second call
});

test('getIssue throws NotFoundError for missing issue', async () => {
  const client = {
    async GetIssue() {
      return { issue: null };
    },
  } as any;
  try {
    await getIssue({ id: 'missing' }, { client });
    throw new Error('should have thrown');
  } catch (err) {
    expect(err instanceof NotFoundError).toBe(true);
  }
});
