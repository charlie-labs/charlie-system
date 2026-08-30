import {
  type GetCommentsQuery,
  type GetCommentsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListCommentsParams = {
  issueId: string;
  limit?: number | undefined;
  pageSize?: number | undefined;
  after?: string | undefined;
};

type ListCommentsContext = {
  client: {
    GetComments: (vars: GetCommentsQueryVariables) => Promise<GetCommentsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

const normalizeCursor = (cursor?: string | null): string | undefined => {
  return cursor && cursor.trim().length > 0 ? cursor : undefined;
};

/**
 * List comments for a given issue.
 *
 * Paginates via {@link paginateConnection} and supports optional caching.
 *
 * @param params.issueId The canonical issue ID whose comments to list.
 * @param params.limit Optional maximum number of comments to return.
 * @param params.pageSize Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param params.after Optional pagination cursor from the previous page. Empty strings are treated as undefined.
 * @param ctx.client Linear SDK subset exposing `GetComments`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, disables caching.
 * @param ctx.cacheTtlMs Optional TTL (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of comment nodes.
 * @throws PaginationError When pagination invariants are violated.
 * @throws ApiRequestError For unexpected/transport errors.
 */
export async function listComments(
  params: ListCommentsParams,
  ctx: ListCommentsContext
): Promise<GetCommentsQuery['comments']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const limit = params.limit;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const seedCursor = normalizeCursor(params.after);
  const cacheKey =
    !disableCache && cache
      ? `listComments:${params.issueId}:${limit ?? 'all'}:${
          seedCursor ?? 'start'
        }`
      : undefined;
  if (cacheKey && cache) {
    const cached = cache.get<GetCommentsQuery['comments']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    let fetched = 0;
    const nodes = await paginateConnection(async (after) => {
      const effectiveAfter =
        after === undefined ? seedCursor : normalizeCursor(after);
      // Determine how many more items we need if a limit was provided
      const remaining =
        typeof limit === 'number'
          ? Math.max(limit - fetched, 0)
          : Number.POSITIVE_INFINITY;

      // If we've already satisfied the limit, end pagination immediately
      if (remaining === 0) {
        return { nodes: [], hasNextPage: false, endCursor: null };
      }

      const first = Math.min(
        pageSize,
        remaining === Number.POSITIVE_INFINITY ? pageSize : remaining
      );

      const { comments } = await client.GetComments({
        first,
        ...(effectiveAfter !== undefined ? { after: effectiveAfter } : {}),
        filter: { issue: { id: { eq: params.issueId } } },
      });

      const pageNodes = comments.nodes;
      fetched += pageNodes.length;

      const continuePaging =
        (typeof limit === 'number' ? fetched < limit : true) &&
        comments.pageInfo.hasNextPage;

      return {
        nodes: pageNodes,
        hasNextPage: continuePaging,
        endCursor: comments.pageInfo.endCursor ?? null,
      };
    });

    // Slice defensively even though we early‑stop, to guarantee length <= limit
    const result = typeof limit === 'number' ? nodes.slice(0, limit) : nodes;

    if (cacheKey && cache) {
      cache.set(cacheKey, result, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return result;
  } catch (err) {
    if (err instanceof PaginationError || err instanceof NotFoundError) {
      throw err;
    }
    throw new ApiRequestError('Failed to list comments', err);
  }
}
