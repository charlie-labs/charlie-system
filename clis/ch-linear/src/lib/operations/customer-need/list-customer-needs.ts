import {
  type CustomerNeedFilter,
  type CustomerNeedsQuery,
  type CustomerNeedsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListCustomerNeedsParams = {
  filter?: CustomerNeedFilter | undefined;
  first?: number | undefined; // page size
  after?: string | undefined; // initial cursor
};

type ListCustomerNeedsContext = {
  client: {
    CustomerNeeds: (
      vars: CustomerNeedsQueryVariables
    ) => Promise<CustomerNeedsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List customer needs, optionally filtered.
 *
 * Uses {@link paginateConnection} for safe pagination and supports the shared short‑lived cache.
 *
 * @param params.filter Optional CustomerNeedFilter to apply server-side.
 * @param params.first Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param params.after Optional initial cursor.
 * @param ctx.client Linear SDK subset exposing `CustomerNeeds`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses caching.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of customer need nodes.
 * @throws PaginationError When pagination invariants are violated.
 * @throws ApiRequestError For unexpected/transport errors.
 */
export async function listCustomerNeeds(
  params: ListCustomerNeedsParams,
  ctx: ListCustomerNeedsContext
): Promise<CustomerNeedsQuery['customerNeeds']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const pageSize = params.first ?? DEFAULT_PAGE_SIZE;
  const initialAfter = params.after;

  const cacheKey =
    !disableCache && cache
      ? `listCustomerNeeds:${JSON.stringify(params.filter)}`
      : undefined;
  if (cacheKey && cache) {
    const cached =
      cache.get<CustomerNeedsQuery['customerNeeds']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    const nodes = await paginateConnection(async (after) => {
      const effectiveAfter = after ?? initialAfter;
      const { customerNeeds } = await client.CustomerNeeds({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(params.filter !== undefined ? { filter: params.filter as any } : {}),
        first: pageSize,
        ...(effectiveAfter !== undefined ? { after: effectiveAfter } : {}),
      });
      return {
        nodes: customerNeeds.nodes,
        hasNextPage: customerNeeds.pageInfo.hasNextPage,
        endCursor: customerNeeds.pageInfo.endCursor ?? null,
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
    throw new ApiRequestError('Failed to list customer needs', err);
  }
}
