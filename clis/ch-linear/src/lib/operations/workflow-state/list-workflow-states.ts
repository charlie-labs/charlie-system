import {
  type GetWorkflowStatesQuery,
  type GetWorkflowStatesQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { PaginationError } from '../../errors/pagination-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';
import { paginateConnection } from '../../pagination/paginate-connection.js';

type ListWorkflowStatesParams = {
  /** Optional maximum number of states to return. */
  limit?: number | undefined;
  pageSize?: number | undefined;
  /** Optional workflow state type filters (e.g. completed, started, triage). */
  types?: string[] | undefined;
};

type ListWorkflowStatesContext = {
  client: {
    GetWorkflowStates: (
      vars: GetWorkflowStatesQueryVariables
    ) => Promise<GetWorkflowStatesQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List workflow states across the workspace.
 *
 * Uses {@link paginateConnection} for defensive pagination and supports optional caching.
 *
 * @param params.limit Optional maximum number of states to return.
 * @param params.pageSize Optional per-request page size (default {@link DEFAULT_PAGE_SIZE}).
 * @param ctx.client Linear SDK subset exposing `GetWorkflowStates`.
 * @param ctx.cache Optional cache provider.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns Array of workflow state nodes.
 * @throws PaginationError When pagination invariants are violated.
 * @throws ApiRequestError For unexpected/transport errors.
 */
type WorkflowStateNode = NonNullable<
  GetWorkflowStatesQuery['workflowStates']['nodes'][number]
>;

export async function listWorkflowStates(
  params: ListWorkflowStatesParams,
  ctx: ListWorkflowStatesContext
): Promise<WorkflowStateNode[]> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const limit = params.limit;
  const typeFilters = (params.types ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  // Deduplicate to avoid redundant comparisons
  const typeSet = new Set(typeFilters);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  // Cache key excludes `limit` so results can be reused across calls. Include
  // only the normalised, sorted type filter set (or `null` when unfiltered).
  const cacheKey =
    !disableCache && cache
      ? `listWorkflowStates:${JSON.stringify([
          typeFilters.length ? Array.from(typeSet).sort() : null,
        ])}`
      : undefined;

  if (cacheKey && cache) {
    const cached = cache.get<WorkflowStateNode[]>(cacheKey);
    if (cached) {
      return typeof limit === 'number' ? cached.slice(0, limit) : cached;
    }
  }

  try {
    // Cache miss: paginate manually so we can early‑stop based on the
    // filtered count (when a limit is provided) without under‑filling.
    const allFiltered: WorkflowStateNode[] = [];
    const limited: WorkflowStateNode[] = [];

    let after: string | undefined;
    let lastCursor: string | undefined;
    let pagesFetched = 0;
    const MAX_PAGES = 1000; // match paginateConnection default
    let exhaustedAllPages = false;

    while (true) {
      if (pagesFetched >= MAX_PAGES) {
        throw new PaginationError(
          `Exceeded maxPages (${MAX_PAGES}) while paginating connection.`
        );
      }

      const { workflowStates } = await client.GetWorkflowStates({
        first: pageSize,
        ...(after !== undefined ? { after } : {}),
      });
      pagesFetched += 1;

      const { nodes, pageInfo } = workflowStates;
      const endCursor = pageInfo.endCursor ?? undefined;
      const hasNextPage = pageInfo.hasNextPage;

      for (const n of nodes) {
        if (!n) continue;
        const t = (n.type ?? '').toLowerCase();
        if (typeSet.size === 0 || typeSet.has(t)) {
          allFiltered.push(n);
          if (typeof limit === 'number' && limited.length < limit) {
            limited.push(n);
          }
        }
      }

      // Early‑stop once we've satisfied the filtered limit
      if (typeof limit === 'number' && limited.length >= limit) {
        exhaustedAllPages = false; // definitely not exhaustive
        break;
      }

      if (!hasNextPage) {
        exhaustedAllPages = true;
        break;
      }

      if (!endCursor) {
        throw new PaginationError(
          'Pagination invariant violation: hasNextPage=true but endCursor is null/undefined.'
        );
      }
      if (lastCursor !== undefined && endCursor === lastCursor) {
        throw new PaginationError(
          'Pagination invariant violation: endCursor did not advance between pages.'
        );
      }
      lastCursor = endCursor;
      after = endCursor;
    }

    // Cache the full filtered set only when exhaustive, per guidance.
    if (cacheKey && cache && exhaustedAllPages) {
      cache.set(cacheKey, allFiltered, cacheTtlMs ?? DEFAULT_TTL_MS);
    }

    return typeof limit === 'number' ? limited : allFiltered;
  } catch (err) {
    if (err instanceof PaginationError) {
      throw err;
    }
    throw new ApiRequestError('Failed to list workflow states', err);
  }
}
