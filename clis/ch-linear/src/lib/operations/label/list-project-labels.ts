import {
  type GetProjectLabelsQuery,
  type GetProjectLabelsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { createEarlyStopCallback } from '../../pagination/early-stop-callback.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListProjectLabelsParams = {
  limit?: number;
  pageSize?: number;
};

type ListProjectLabelsContext = {
  client: {
    GetProjectLabels: (
      vars: GetProjectLabelsQueryVariables
    ) => Promise<GetProjectLabelsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List project labels across the workspace.
 *
 * Mirrors {@link listLabels} but queries the `projectLabels` connection.
 */
export async function listProjectLabels(
  params: ListProjectLabelsParams,
  ctx: ListProjectLabelsContext
): Promise<GetProjectLabelsQuery['projectLabels']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const limit = params.limit;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache ? `listProjectLabels:${limit ?? 'all'}` : undefined;
  if (cacheKey && cache) {
    const cached =
      cache.get<GetProjectLabelsQuery['projectLabels']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    const nodes = await paginateConnection<
      GetProjectLabelsQuery['projectLabels']['nodes'][number]
    >(
      createEarlyStopCallback({
        ...(limit !== undefined ? { limit } : {}),
        pageSize,
        fetch: async ({ first, after }) => {
          const { projectLabels } = await client.GetProjectLabels({
            first,
            ...(after !== undefined ? { after } : {}),
          });
          return {
            nodes: projectLabels.nodes,
            hasNextPage: projectLabels.pageInfo.hasNextPage,
            endCursor: projectLabels.pageInfo.endCursor ?? null,
          };
        },
      })
    );

    if (cacheKey && cache) {
      cache.set(cacheKey, nodes, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return nodes;
  } catch (err) {
    if (err instanceof PaginationError) throw err;
    throw new ApiRequestError('Failed to list project labels', err);
  }
}
