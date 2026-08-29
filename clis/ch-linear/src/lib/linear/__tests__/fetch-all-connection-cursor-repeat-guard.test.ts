/* eslint-disable no-console */

import { expect, test } from 'bun:test';

import { fetchAllConnection } from '../cache-loaders.js';

test('fetchAllConnection stops when the API returns the same cursor twice', async () => {
  // Fake pages: second page hasNext = true but repeats the cursor "c1"
  const pages = [
    { nodes: [1, 2], hasNext: true, cursor: 'c1' },
    { nodes: [3, 4], hasNext: true, cursor: 'c1' },
  ];

  let pageIdx = 0;

  // Capture console.warn output so we can assert that our guard was triggered
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(String(args[0]));
  };

  try {
    const result = await fetchAllConnection<number>(
      async () => pages[pageIdx++]!
    );

    expect(result).toEqual([1, 2, 3, 4]);
    expect(pageIdx).toBe(2); // only two API calls, loop terminated early
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/endCursor did not advance/);
  } finally {
    // Always restore the original console.warn
    console.warn = origWarn;
  }
});
