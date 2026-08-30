import {
  type GetInitiativesQuery,
  type GetInitiativesQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListInitiativesParams = {
  limit?: number | undefined;
  pageSize?: number | undefined;
};

type ListInitiativesContext = {
  client: {
    GetInitiatives: (
      vars: GetInitiativesQueryVariables
    ) => Promise<GetInitiativesQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List initiatives from Linear, optionally limiting the number of returned nodes.
 *
 * Results are fetched across pages using {@link paginateConnection}, which enforces pagination
 * invariants and may throw {@link PaginationError} on malformed responses. A short‑lived cache can
 * be enabled via the provided context.
 *
 * @param params.limit Optional maximum number of initiatives to return. When omitted, all initiatives
 *   will be fetched.
 * @param params.pageSize Optional per-request page size (defaults to {@link DEFAULT_PAGE_SIZE}).
 * @param ctx.client Linear SDK subset exposing `GetInitiatives`.
 * @param ctx.cache Optional cache provider used when caching is enabled.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL (ms) override for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of initiative nodes.
 * @throws PaginationError When pagination invariants are violated.
 * @throws ApiRequestError For unexpected/transport errors.
 */
export async function listInitiatives(
  params: ListInitiativesParams,
  ctx: ListInitiativesContext
): Promise<GetInitiativesQuery['initiatives']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const limit = params.limit;

  const cacheKey =
    !disableCache && cache ? `listInitiatives:${limit ?? 'all'}` : undefined;
  if (cacheKey && cache) {
    const cached =
      cache.get<GetInitiativesQuery['initiatives']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    let fetched = 0;
    const nodes = await paginateConnection(async (after) => {
      // Determine how many we still need to fulfill caller's limit
      const remaining =
        typeof limit === 'number'
          ? Math.max(limit - fetched, 0)
          : Number.POSITIVE_INFINITY;
      // If remaining is 0, stop paginating
      if (remaining === 0) {
        return { nodes: [], hasNextPage: false, endCursor: null };
      }

      const first = Math.min(
        pageSize,
        remaining === Number.POSITIVE_INFINITY ? pageSize : remaining
      );

      const { initiatives } = await client.GetInitiatives({
        first,
        ...(after !== undefined ? { after } : {}),
      });

      const pageNodes = initiatives.nodes;
      fetched += pageNodes.length;

      const continuePaging =
        (typeof limit === 'number' ? fetched < limit : true) &&
        initiatives.pageInfo.hasNextPage;

      return {
        nodes: pageNodes,
        hasNextPage: continuePaging,
        endCursor: initiatives.pageInfo.endCursor ?? null,
      };
    });

    // No need to slice: paginateConnection stopped when limit satisfied
    const result = typeof limit === 'number' ? nodes.slice(0, limit) : nodes;

    if (cacheKey && cache) {
      cache.set(cacheKey, result, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return result;
  } catch (err) {
    if (err instanceof PaginationError || err instanceof NotFoundError) {
      throw err;
    }
    throw new ApiRequestError('Failed to list initiatives', err);
  }
}
