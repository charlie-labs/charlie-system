import { expect, test } from 'bun:test';

import { getOrSet } from '../index.js';

test('getOrSet executes the fetcher only once when called concurrently', async () => {
  let callCount = 0;

  const fetcher = async (): Promise<string> => {
    callCount += 1;
    // simulate latency
    await new Promise((r) => setTimeout(r, 25));
    return 'ok';
  };

  const [a, b, c] = await Promise.all([
    getOrSet('issue:concurrency-key', fetcher),
    getOrSet('issue:concurrency-key', fetcher),
    getOrSet('issue:concurrency-key', fetcher),
  ]);

  expect(callCount).toBe(1);
  expect(a).toBe('ok');
  expect(b).toBe('ok');
  expect(c).toBe('ok');
});
