import { DEFAULT_PAGE_SIZE } from './default-page-size.js';

/**
 * Create a stateful `paginateConnection` callback that performs client-side
 * early‑stop pagination.
 *
 * The returned function tracks how many nodes have been fetched so far and:
 * - Computes the remaining count based on the caller-provided `limit`.
 * - Adjusts the per-request `first` value (`Math.min(pageSize, remaining)`).
 * - Forces `hasNextPage` to `false` once the limit is satisfied so the
 *   surrounding {@link paginateConnection} loop terminates without making
 *   unnecessary extra API calls.
 * - Normalizes a missing `endCursor` to `null` to keep cursor handling
 *   consistent across the codebase.
 *
 * Errors thrown by the provided `fetch` function are propagated unchanged; this
 * helper never wraps or translates errors. Domain errors like
 * {@link PaginationError} are expected to be handled by the caller that
 * invokes {@link paginateConnection}.
 *
 * @typeParam T Node type returned by the underlying connection.
 * @param options.limit Optional overall maximum number of nodes to return. When
 *   omitted, all available nodes are fetched (subject to server pagination).
 * @param options.pageSize Per-request page size to pass to the fetcher. When
 *   unspecified, {@link DEFAULT_PAGE_SIZE} is used.
 * @param options.initialAfter Optional initial cursor to use on the first
 *   invocation when the surrounding `paginateConnection` provides `undefined`.
 *   Subsequent pages always use the cursor provided by `paginateConnection`.
 * @param options.fetch Function that performs the underlying request given a
 *   `first` and `after` cursor and returns the connection page fields.
 *   The function must NOT perform any slicing based on `limit`; this helper
 *   manages early‑stop behavior.
 * @returns A `(after?: string) => Promise<{ nodes, hasNextPage, endCursor }>`
 *   callback suitable to pass directly to {@link paginateConnection}.
 */
export function createEarlyStopCallback<T>(options: {
  limit?: number | undefined;
  pageSize?: number | undefined;
  initialAfter?: string | undefined;
  fetch: (args: { first: number; after?: string | undefined }) => Promise<{
    nodes: T[];
    hasNextPage: boolean;
    endCursor?: string | null | undefined;
  }>;
}): (after?: string) => Promise<{
  nodes: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}> {
  const hasLimit = typeof options.limit === 'number';
  const limitValue = hasLimit
    ? (options.limit as number)
    : Number.POSITIVE_INFINITY;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  let fetched = 0;

  return async (after?: string) => {
    const remaining = limitValue - fetched;
    if (remaining <= 0) {
      return { nodes: [], hasNextPage: false, endCursor: null };
    }

    const first = Math.min(pageSize, remaining);
    const actualAfter = after ?? options.initialAfter;

    const { nodes, hasNextPage, endCursor } = await options.fetch({
      first,
      after: actualAfter,
    });

    fetched += nodes.length;
    const continuePaging =
      (hasLimit ? fetched < limitValue : true) && hasNextPage;

    return {
      nodes,
      hasNextPage: continuePaging,
      endCursor: endCursor ?? null,
    };
  };
}
