import {
  type GetTeamsQuery,
  type GetTeamsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { createEarlyStopCallback } from '../../pagination/early-stop-callback.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListTeamsParams = {
  /** Optional maximum number of teams to return. If omitted, returns all. */
  limit?: number | undefined;
  /** Page size to use per GraphQL request (default {@link DEFAULT_PAGE_SIZE}). */
  pageSize?: number | undefined;
};

type ListTeamsContext = {
  client: {
    GetTeams: (vars: GetTeamsQueryVariables) => Promise<GetTeamsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List teams in the workspace, optionally limiting the total number returned.
 *
 * Results are collected via {@link paginateConnection} and may be cached.
 *
 * @param params.limit Optional maximum number of teams to return. If omitted, all teams are returned.
 * @param params.pageSize Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param ctx.client Linear SDK subset exposing `GetTeams`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses caching entirely.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of team nodes.
 * @throws PaginationError If pagination invariants are violated.
 * @throws ApiRequestError On unexpected/transport failures.
 */
export async function listTeams(
  params: ListTeamsParams,
  ctx: ListTeamsContext
): Promise<GetTeamsQuery['teams']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const limit = params.limit;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache ? `listTeams:${limit ?? 'all'}` : undefined;
  if (cacheKey && cache) {
    const cached = cache.get<GetTeamsQuery['teams']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    const nodes = await paginateConnection(
      createEarlyStopCallback({
        ...(limit !== undefined ? { limit } : {}),
        pageSize,
        fetch: async ({ first, after }) => {
          const { teams } = await client.GetTeams({
            first,
            ...(after !== undefined ? { after } : {}),
          });
          return {
            nodes: teams.nodes,
            hasNextPage: teams.pageInfo.hasNextPage,
            endCursor: teams.pageInfo.endCursor ?? null,
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
    throw new ApiRequestError('Failed to list teams', err);
  }
}

// no default export
