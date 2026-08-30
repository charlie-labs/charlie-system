import { expect, test } from 'bun:test';

import { fetchAllConnection } from '../cache-loaders.js';

test('fetchAllConnection collects every page exactly once', async () => {
  const pages = [
    { nodes: [1, 2, 3], hasNext: true, cursor: 'c1' },
    { nodes: [4, 5], hasNext: false, cursor: undefined },
  ];

  let pageIdx = 0;
  const seenAfters: (string | undefined)[] = [];

  const result = await fetchAllConnection<number>(async (after) => {
    seenAfters.push(after);
    return pages[pageIdx++]!;
  });

  expect(result).toEqual([1, 2, 3, 4, 5]);
  expect(pageIdx).toBe(2); // two API calls
  expect(seenAfters).toEqual([undefined, 'c1']); // correct cursors passed
});
