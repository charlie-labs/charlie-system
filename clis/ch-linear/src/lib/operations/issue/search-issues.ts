import {
  type SearchIssuesQuery,
  type SearchIssuesQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type SearchIssuesParams = {
  term: string;
  /**
   * Maximum number of issues to return. Mirrors the `--limit` flag at the CLI layer.
   */
  first: number;
  /** Optional initial cursor – currently unused by the CLI but supported for completeness. */
  after?: string;
  /** Optional per-request page size. Defaults to {@link DEFAULT_PAGE_SIZE}.
   *  If smaller than `first`, multiple pages will be fetched using `paginateConnection`.
   */
  pageSize?: number;
};

type SearchIssuesContext = {
  client: {
    SearchIssues: (
      vars: SearchIssuesQueryVariables
    ) => Promise<SearchIssuesQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};
/**
 * Search for issues using Linear's `searchIssues` API and return up to `first` matching nodes.
 *
 * This operation applies the same short‑lived caching and pagination safety patterns used by other
 * read/list operations. When `first` exceeds the server's page size limit, results are collected
 * across pages using `paginateConnection`, which raises `PaginationError` on invariant violations.
 *
 * @param params.term Free‑text query plus qualifiers (already composed by the CLI layer).
 * @param params.first Maximum number of results to return. When `0`, no network
 *   request is made and an empty array is returned immediately. If caching is
 *   enabled, the empty result is written to the cache with the configured TTL.
 * @param params.after Optional starting cursor.
 * @param params.pageSize Optional per-request page size (defaults to {@link DEFAULT_PAGE_SIZE}).
 * @param ctx.client Linear SDK subset providing `SearchIssues`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL override when writing to the cache.
 * @returns Array of issue nodes, length <= `first`.
 * @throws PaginationError When the API reports `hasNextPage` without advancing the cursor, etc.
 * @throws ApiRequestError For transport or other request failures.
 */
export async function searchIssues(
  params: SearchIssuesParams,
  ctx: SearchIssuesContext
): Promise<SearchIssuesQuery['searchIssues']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;

  const limit = params.first;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache
      ? `searchIssues:${JSON.stringify([params.term, limit, params.after ?? null])}`
      : undefined;

  if (cacheKey && cache) {
    const cached =
      cache.get<SearchIssuesQuery['searchIssues']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  // Fast path: caller requested zero results – avoid a network call
  if (limit === 0) {
    if (cacheKey && cache) {
      cache.set(cacheKey, [], cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return [];
  }

  try {
    let fetched = 0;
    const nodes = await paginateConnection(async (after?: string) => {
      const remaining = limit - fetched;
      const first = Math.min(pageSize, remaining);

      const { searchIssues } = await client.SearchIssues({
        term: params.term,
        first,
        ...((after ?? params.after) !== undefined
          ? { after: after ?? params.after }
          : {}),
      });

      const pageNodes = searchIssues.nodes;
      fetched += pageNodes.length;

      // Stop paginating early when we've reached the caller's limit
      const continuePaging =
        fetched < limit && searchIssues.pageInfo.hasNextPage;

      return {
        nodes: pageNodes,
        hasNextPage: continuePaging,
        endCursor: searchIssues.pageInfo.endCursor ?? null,
      };
    });

    if (cacheKey && cache) {
      cache.set(cacheKey, nodes, cacheTtlMs ?? DEFAULT_TTL_MS);
    }

    return nodes;
  } catch (err) {
    if (err instanceof PaginationError) throw err;
    throw new ApiRequestError('Failed to search issues', err);
  }
}
