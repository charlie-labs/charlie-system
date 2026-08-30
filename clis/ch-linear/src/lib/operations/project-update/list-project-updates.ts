import {
  type ListProjectUpdatesQuery,
  type ListProjectUpdatesQueryVariables,
  type PaginationOrderBy,
  type ProjectUpdateHealthType,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type UpdateNode = ListProjectUpdatesQuery['projectUpdates']['nodes'][number];

type ComparatorMap = {
  gt?: string | undefined;
  gte?: string | undefined;
  lt?: string | undefined;
  lte?: string | undefined;
  eq?: string | undefined;
};

type ListProjectUpdatesParams = {
  projectId?: string | undefined;
  userId?: string | undefined;
  health?: ProjectUpdateHealthType[] | ProjectUpdateHealthType | undefined;
  createdAt?: ComparatorMap | undefined;
  orderBy?: 'createdAt' | undefined;
  first?: number | undefined;
  after?: string | undefined;
  archived?: boolean | undefined; // when true, only archived updates
};

type ListProjectUpdatesContext = {
  client: {
    ListProjectUpdates: (
      vars: ListProjectUpdatesQueryVariables
    ) => Promise<ListProjectUpdatesQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List project updates using structured GraphQL filters.
 */
export async function listProjectUpdates(
  params: ListProjectUpdatesParams,
  ctx: ListProjectUpdatesContext
): Promise<ListProjectUpdatesQuery['projectUpdates']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;

  const limit = params.first;
  const needsClientFiltering =
    Boolean(params.health) || Boolean(params.archived);

  const cacheKey =
    !disableCache && cache
      ? `listProjectUpdates:${JSON.stringify([
          params.projectId ?? null,
          params.userId ?? null,
          Array.isArray(params.health)
            ? [...params.health].sort()
            : (params.health ?? null),
          params.createdAt ?? null,
          params.orderBy ?? null,
          params.first ?? null,
          params.after ?? null,
          params.archived ?? null,
        ])}`
      : undefined;

  if (cacheKey && cache) {
    const cached =
      cache.get<ListProjectUpdatesQuery['projectUpdates']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  const filter: Record<string, unknown> = {};
  const relationIdEq = (id?: string) => (id ? { id: { eq: id } } : undefined);

  if (params.projectId) filter['project'] = relationIdEq(params.projectId);
  if (params.userId) filter['user'] = relationIdEq(params.userId);

  if (params.createdAt) filter['createdAt'] = params.createdAt;

  const includeArchived = params.archived ? true : undefined;
  const archivedOnly = params.archived === true;
  const healthFilter = params.health
    ? new Set(
        (Array.isArray(params.health) ? params.health : [params.health]).filter(
          Boolean
        )
      )
    : undefined;

  const matchesClientFilters = (node: UpdateNode): boolean => {
    if (archivedOnly && node.archivedAt == null) return false;
    if (healthFilter && !healthFilter.has(node.health)) return false;
    return true;
  };

  try {
    // Fast-path when no client-side filtering is requested. This keeps the
    // previous behaviour of a single request.
    if (!needsClientFiltering) {
      const resp = await client.ListProjectUpdates({
        filter,
        ...(limit !== undefined ? { first: limit } : {}),
        ...(params.after !== undefined ? { after: params.after } : {}),
        ...(params.orderBy !== undefined
          ? { orderBy: params.orderBy as PaginationOrderBy }
          : {}),
        ...(includeArchived !== undefined ? { includeArchived } : {}),
      });

      const nodes = resp.projectUpdates.nodes;
      if (cacheKey && cache) {
        cache.set(cacheKey, nodes, cacheTtlMs ?? DEFAULT_TTL_MS);
      }
      return nodes;
    }

    // Client-side filtering requires pagination so CLI `--limit` is honoured.
    // We keep fetching pages until we have enough *matching* nodes.
    let matched = 0;

    const nodes = await paginateConnection<UpdateNode>(
      async (after?: string) => {
        const effectiveAfter = after ?? params.after;
        const resp = await client.ListProjectUpdates({
          filter,
          first: DEFAULT_PAGE_SIZE,
          ...(effectiveAfter !== undefined ? { after: effectiveAfter } : {}),
          ...(params.orderBy !== undefined
            ? { orderBy: params.orderBy as PaginationOrderBy }
            : {}),
          ...(includeArchived !== undefined ? { includeArchived } : {}),
        });

        const pageNodes =
          resp.projectUpdates.nodes.filter(matchesClientFilters);
        matched += pageNodes.length;

        const continuePaging =
          limit !== undefined
            ? matched < limit && resp.projectUpdates.pageInfo.hasNextPage
            : resp.projectUpdates.pageInfo.hasNextPage;

        return {
          nodes: pageNodes,
          hasNextPage: continuePaging,
          endCursor: resp.projectUpdates.pageInfo.endCursor ?? null,
        };
      }
    );

    const sliced = limit !== undefined ? nodes.slice(0, limit) : nodes;
    if (cacheKey && cache) {
      cache.set(cacheKey, sliced, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return sliced;
  } catch (err) {
    if (err instanceof PaginationError) throw err;
    throw new ApiRequestError('Failed to list project updates', err);
  }
}

// No default export – keep public API purely named.
