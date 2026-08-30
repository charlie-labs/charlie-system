import {
  type GetIssueLabelsQuery,
  type GetIssueLabelsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { createEarlyStopCallback } from '../../pagination/early-stop-callback.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListLabelsParams = {
  limit?: number;
  pageSize?: number;
};

type ListLabelsContext = {
  client: {
    GetIssueLabels: (
      vars: GetIssueLabelsQueryVariables
    ) => Promise<GetIssueLabelsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List issue labels across the workspace.
 *
 * Uses {@link paginateConnection} for safe pagination and supports short‑lived caching.
 *
 * @param params.limit Optional maximum number of labels to return. If omitted, all labels are fetched.
 * @param params.pageSize Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param ctx.client Linear SDK subset exposing `GetIssueLabels`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of label nodes.
 * @throws PaginationError When pagination invariants break.
 * @throws ApiRequestError For unexpected/transport errors.
 */
export async function listLabels(
  params: ListLabelsParams,
  ctx: ListLabelsContext
): Promise<GetIssueLabelsQuery['issueLabels']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const limit = params.limit;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache ? `listLabels:${limit ?? 'all'}` : undefined;
  if (cacheKey && cache) {
    const cached =
      cache.get<GetIssueLabelsQuery['issueLabels']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    const nodes = await paginateConnection<
      GetIssueLabelsQuery['issueLabels']['nodes'][number]
    >(
      createEarlyStopCallback({
        ...(limit !== undefined ? { limit } : {}),
        pageSize,
        fetch: async ({ first, after }) => {
          const { issueLabels } = await client.GetIssueLabels({
            first,
            ...(after !== undefined ? { after } : {}),
          });
          return {
            nodes: issueLabels.nodes,
            hasNextPage: issueLabels.pageInfo.hasNextPage,
            endCursor: issueLabels.pageInfo.endCursor ?? null,
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
    throw new ApiRequestError('Failed to list labels', err);
  }
}
