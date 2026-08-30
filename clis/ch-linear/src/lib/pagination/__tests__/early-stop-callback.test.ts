import { expect, test } from 'bun:test';

import { PaginationError } from '../../errors/pagination-error.js';
import { createEarlyStopCallback } from '../early-stop-callback.js';
import { paginateConnection } from '../paginate-connection.js';

test('early-stop respects small limits and avoids extra fetches', async () => {
  const firstArgs: number[] = [];
  let call = 0;

  const cb = createEarlyStopCallback<number>({
    limit: 3,
    pageSize: 50,
    fetch: async ({ first }) => {
      firstArgs.push(first);
      call += 1;
      // Simulate server returning fewer than requested on the first call
      const count = call === 1 ? 2 : 1;
      const nodes = Array.from(
        { length: count },
        (_, i) => i + (call - 1) * 10
      );
      return { nodes, hasNextPage: true, endCursor: `c${call}` };
    },
  });

  const nodes = await paginateConnection(cb);
  expect(nodes.length).toBe(3);
  expect(firstArgs).toEqual([3, 1]); // remaining adjusted on second call
  expect(call).toBe(2); // stopped as soon as limit was satisfied
});

test('early-stop honors pageSize when limit is large', async () => {
  const firstArgs: number[] = [];
  let value = 0;
  const cb = createEarlyStopCallback<number>({
    limit: 120,
    pageSize: 50,
    fetch: async ({ first, after }) => {
      firstArgs.push(first);
      const nodes = Array.from({ length: Math.min(first, 60) }, () => value++);
      // Always advertise more pages; early-stop will flip hasNextPage once satisfied
      const nextCursor = after ? `${after}_n` : 'c1';
      return { nodes, hasNextPage: true, endCursor: nextCursor };
    },
  });

  const nodes = await paginateConnection(cb);
  expect(nodes.length).toBe(120);
  expect(firstArgs).toEqual([50, 50, 20]);
});

test('propagates PaginationError from paginateConnection', async () => {
  const cb = createEarlyStopCallback<number>({
    // unlimited
    pageSize: 10,
    fetch: async () => {
      // Return hasNextPage=true but without advancing cursor -> paginateConnection should throw
      return { nodes: [1], hasNextPage: true, endCursor: null };
    },
  });

  try {
    await paginateConnection(cb);
    throw new Error('expected PaginationError');
  } catch (err) {
    expect(err instanceof PaginationError).toBe(true);
  }
});

test('uses initialAfter on the first invocation when provided', async () => {
  const seenAfters: (string | undefined)[] = [];
  let call = 0;
  const cb = createEarlyStopCallback<number>({
    limit: 2,
    pageSize: 10,
    initialAfter: 'start',
    fetch: async ({ after }) => {
      seenAfters.push(after);
      call += 1;
      return { nodes: [1], hasNextPage: call < 2, endCursor: `c${call}` };
    },
  });

  const nodes = await paginateConnection(cb);
  expect(nodes.length).toBe(2);
  expect(seenAfters[0]).toBe('start');
  expect(seenAfters[1]).toBe('c1');
});
