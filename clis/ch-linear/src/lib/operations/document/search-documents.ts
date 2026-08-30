import {
  type ListDocumentsQuery,
  type ListDocumentsQueryVariables,
  type SearchDocumentsQuery,
  type SearchDocumentsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type SearchDocumentsParams = {
  /**
   * Free-text search term. When omitted/empty, this operation falls back to a simple list of documents.
   */
  term?: string;
  /** Maximum number of documents to return. Mirrors the CLI `--limit` flag. */
  first: number;
  /** Optional initial cursor. Not currently used by the CLI but supported for completeness. */
  after?: string;
  /** Optional per-request page size. Defaults to {@link DEFAULT_PAGE_SIZE}. */
  pageSize?: number;
};

type SearchDocumentsContext = {
  client: {
    SearchDocuments: (
      vars: SearchDocumentsQueryVariables
    ) => Promise<SearchDocumentsQuery>;
    ListDocuments: (
      vars: ListDocumentsQueryVariables
    ) => Promise<ListDocumentsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

type DocumentSearchNode =
  | SearchDocumentsQuery['searchDocuments']['nodes'][number]
  | ListDocumentsQuery['documents']['nodes'][number];

/**
 * Search or list documents using Linear's GraphQL API.
 *
 * If `params.term` is provided, the underlying `searchDocuments` query is used; otherwise the
 * `documents` connection is listed. In both cases, results are paginated safely via
 * {@link paginateConnection} and cached using the standard short-lived cache (unless disabled).
 *
 * @param params.term Optional free-text term. When falsy, behaves like a simple list operation.
 * @param params.first Maximum number of nodes to return.
 * @param params.after Optional starting cursor.
 * @param params.pageSize Optional per-request page size (defaults to {@link DEFAULT_PAGE_SIZE}).
 * @param ctx.client Linear SDK subset with SearchDocuments/ListDocuments.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses cache completely.
 * @param ctx.cacheTtlMs Optional TTL override for cache writes.
 * @returns Array of document nodes (length <= `first`).
 * @throws PaginationError If pagination invariants are violated.
 * @throws ApiRequestError On transport/request failures.
 */
export async function searchDocuments(
  params: SearchDocumentsParams,
  ctx: SearchDocumentsContext
): Promise<DocumentSearchNode[]> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;

  const limit = params.first;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache
      ? `searchDocuments:${JSON.stringify({
          term: params.term ?? '',
          limit,
          after: params.after ?? null,
        })}`
      : undefined;

  if (cacheKey && cache) {
    const cached = cache.get<DocumentSearchNode[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    let fetched = 0;
    const nodes = await paginateConnection<DocumentSearchNode>(
      async (after?: string) => {
        const remaining = limit - fetched;
        const first = Math.min(pageSize, remaining);

        if (!params.term) {
          const { documents } = await client.ListDocuments({
            first,
            ...((after ?? params.after) !== undefined
              ? { after: after ?? params.after }
              : {}),
          });

          const pageNodes = documents.nodes as DocumentSearchNode[];
          fetched += pageNodes.length;

          const continuePaging =
            fetched < limit && documents.pageInfo.hasNextPage;

          return {
            nodes: pageNodes,
            hasNextPage: continuePaging,
            endCursor: documents.pageInfo.endCursor ?? null,
          };
        }

        const { searchDocuments } = await client.SearchDocuments({
          term: params.term,
          first,
          ...((after ?? params.after) !== undefined
            ? { after: after ?? params.after }
            : {}),
        });

        const pageNodes = searchDocuments.nodes as DocumentSearchNode[];
        fetched += pageNodes.length;

        const continuePaging =
          fetched < limit && searchDocuments.pageInfo.hasNextPage;

        return {
          nodes: pageNodes,
          hasNextPage: continuePaging,
          endCursor: searchDocuments.pageInfo.endCursor ?? null,
        };
      }
    );

    const sliced = nodes.slice(0, limit);

    if (cacheKey && cache) {
      cache.set(cacheKey, sliced, cacheTtlMs ?? DEFAULT_TTL_MS);
    }

    return sliced;
  } catch (err) {
    if (err instanceof PaginationError) throw err;
    throw new ApiRequestError('Failed to search documents', err);
  }
}
