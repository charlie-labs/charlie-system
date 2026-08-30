import {
  type GetCustomersQuery,
  type GetCustomersQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListCustomersParams = {
  first?: number | undefined; // page size
  after?: string | undefined; // initial cursor
};

type ListCustomersContext = {
  client: {
    GetCustomers: (
      vars: GetCustomersQueryVariables
    ) => Promise<GetCustomersQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List customers. Supports paging via {@link paginateConnection} and optional caching.
 *
 * @param params.first Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param params.after Optional initial cursor.
 * @param ctx.client Linear SDK subset exposing `GetCustomers`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, disables caching.
 * @param ctx.cacheTtlMs Optional TTL (ms) to use on cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of customer nodes.
 * @throws PaginationError When pagination invariants are violated.
 * @throws ApiRequestError For unexpected/transport errors.
 */
export async function listCustomers(
  params: ListCustomersParams,
  ctx: ListCustomersContext
): Promise<GetCustomersQuery['customers']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const pageSize = params.first ?? DEFAULT_PAGE_SIZE;
  const initialAfter = params.after;

  const cacheKey =
    !disableCache && cache
      ? `listCustomers:${pageSize}:${initialAfter ?? ''}`
      : undefined;
  if (cacheKey && cache) {
    const cached = cache.get<GetCustomersQuery['customers']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    const nodes = await paginateConnection(async (after) => {
      const effectiveAfter = after ?? initialAfter;
      const { customers } = await client.GetCustomers({
        first: pageSize,
        ...(effectiveAfter !== undefined ? { after: effectiveAfter } : {}),
      });
      return {
        nodes: customers.nodes,
        hasNextPage: customers.pageInfo.hasNextPage,
        endCursor: customers.pageInfo.endCursor ?? null,
      };
    });

    if (cacheKey && cache) {
      cache.set(cacheKey, nodes, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return nodes;
  } catch (err) {
    if (err instanceof PaginationError || err instanceof NotFoundError) {
      throw err;
    }
    throw new ApiRequestError('Failed to list customers', err);
  }
}
