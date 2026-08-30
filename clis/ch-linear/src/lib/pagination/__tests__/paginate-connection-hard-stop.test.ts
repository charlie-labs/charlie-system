import { expect, test } from 'bun:test';

import { PaginationError } from '../../errors/pagination-error.js';
import { paginateConnection } from '../paginate-connection.js';

test('paginateConnection enforces maxPages hard-stop', async () => {
  let page = 0;

  try {
    await paginateConnection<number>(
      async () => {
        page += 1;
        return {
          nodes: [],
          hasNextPage: true,
          endCursor: `c${page}`,
        };
      },
      { maxPages: 3 }
    );

    throw new Error('should have thrown');
  } catch (err) {
    expect(err instanceof PaginationError).toBe(true);
    // We should have attempted exactly 3 pages, then thrown before the 4th fetch
    expect(page).toBe(3);
  }
});
