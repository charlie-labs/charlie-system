import { PaginationError } from '../errors/pagination-error.js';

/** Default upper bound on number of pages we will request before aborting. */
const DEFAULT_MAX_PAGES = 1000;

/**
 * Exhaust a GraphQL-style cursor connection that exposes `{ nodes, pageInfo { hasNextPage, endCursor } }`.
 *
 * This helper defensively validates pagination invariants and enforces a hard stop to avoid runaway loops
 * if an upstream API continually advertises more pages.
 *
 * @typeParam T Node type contained in the connection.
 * @param fetchPage Function that fetches a single page given an optional `after` cursor and returns the
 * page payload: `{ nodes, hasNextPage, endCursor }`.
 * @param options Optional safety options.
 * @param options.maxPages Maximum number of pages to fetch before throwing a `PaginationError`.
 * Defaults to 1000 if omitted.
 * @returns All concatenated `nodes` from every fetched page.
 * @throws PaginationError If `hasNextPage` is true without a valid advancing `endCursor`, if the cursor
 * fails to advance between pages, or if the `maxPages` limit is exceeded.
 */
export async function paginateConnection<T>(
  fetchPage: (after?: string) => Promise<{
    nodes: T[];
    hasNextPage: boolean;
    endCursor?: string | null | undefined;
  }>,
  options?: { maxPages?: number | undefined }
): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  let lastCursor: string | undefined;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  let pagesFetched = 0;

  // Loop until the server reports no further pages or a safety condition triggers
  while (true) {
    if (pagesFetched >= maxPages) {
      throw new PaginationError(
        `Exceeded maxPages (${maxPages}) while paginating connection.`
      );
    }

    const { nodes, hasNextPage, endCursor } = await fetchPage(after);
    pagesFetched += 1;
    out.push(...nodes);

    if (!hasNextPage) break;

    if (!endCursor) {
      throw new PaginationError(
        'Pagination invariant violation: hasNextPage=true but endCursor is null/undefined.'
      );
    }

    if (lastCursor !== undefined && endCursor === lastCursor) {
      throw new PaginationError(
        'Pagination invariant violation: endCursor did not advance between pages.'
      );
    }

    lastCursor = endCursor;
    after = endCursor;
  }

  return out;
}
