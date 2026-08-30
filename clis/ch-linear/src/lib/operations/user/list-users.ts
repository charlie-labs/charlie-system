import {
  type GetUsersQuery,
  type GetUsersQueryVariables,
  type UserFilter,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { createEarlyStopCallback } from '../../pagination/early-stop-callback.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListUsersParams = {
  filter?: UserFilter | undefined;
  limit?: number | undefined; // max number of users to return
  pageSize?: number | undefined; // per-request page size
  after?: string | undefined; // initial cursor
};

type ListUsersContext = {
  client: {
    GetUsers: (vars: GetUsersQueryVariables) => Promise<GetUsersQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List users with optional server-side filtering and client-side limiting.
 *
 * Fetches pages using {@link paginateConnection} and caches the result using the shared short‑lived
 * cache (unless disabled).
 *
 * @param params.filter Optional Linear `UserFilter` to apply.
 * @param params.limit Optional maximum number of users to return (client-side slice).
 *   When `0`, the function returns an empty array without making a network call.
 *   If caching is enabled, the empty result is written to the cache with the configured TTL.
 * @param params.pageSize Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param params.after Optional starting cursor.
 * @param ctx.client Linear SDK subset exposing `GetUsers`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of user nodes.
 * @throws PaginationError When pagination invariants are violated.
 * @throws ApiRequestError For unexpected/transport errors.
 */
export async function listUsers(
  params: ListUsersParams,
  ctx: ListUsersContext
): Promise<GetUsersQuery['users']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const rawLimit = params.limit;
  const effectiveLimit = rawLimit ?? Number.POSITIVE_INFINITY;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache
      ? `listUsers:${JSON.stringify({
          filter: params.filter ?? null,
          limit: rawLimit ?? 'all',
          after: params.after ?? null,
        })}`
      : undefined;

  if (cacheKey && cache) {
    const cached = cache.get<GetUsersQuery['users']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  // Fast path: limit=0 should not hit the network. Cache the empty result when enabled.
  if (rawLimit === 0) {
    if (cacheKey && cache) {
      cache.set(cacheKey, [], cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return [];
  }

  try {
    const nodes = await paginateConnection(
      createEarlyStopCallback({
        limit: effectiveLimit,
        pageSize,
        ...(params.after !== undefined ? { initialAfter: params.after } : {}),
        fetch: async ({ first, after }) => {
          const { users } = await client.GetUsers({
            first,
            ...(after !== undefined ? { after } : {}),
            ...(params.filter !== undefined ? { filter: params.filter } : {}),
          });
          return {
            nodes: users.nodes,
            hasNextPage: users.pageInfo.hasNextPage,
            endCursor: users.pageInfo.endCursor ?? null,
          };
        },
      })
    );

    if (cacheKey && cache) {
      cache.set(cacheKey, nodes, cacheTtlMs ?? DEFAULT_TTL_MS);
    }

    return nodes;
  } catch (err) {
    if (err instanceof PaginationError) {
      throw err;
    }
    throw new ApiRequestError('Failed to list users', err);
  }
}
