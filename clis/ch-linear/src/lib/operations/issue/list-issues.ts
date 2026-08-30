import {
  type ListIssuesQuery,
  type ListIssuesQueryVariables,
  type PaginationOrderBy,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type ListIssuesParams = {
  teamIds?: string[] | undefined;
  labelIds?: string[] | undefined;
  stateIds?: string[] | undefined;
  assigneeId?: string | undefined;
  /** Optional delegated agent user ID to filter by. */
  delegateId?: string | undefined;
  creatorId?: string | undefined;
  parentId?: string | undefined;
  /**
   * When true, restrict results to issues that are in the active cycle of
   * their respective teams. This corresponds to GraphQL filter
   * `cycle: { isActive: { eq: true } }` and is included in the cache key
   * (cached results for `activeCycle: true` are distinct from `undefined`).
   */
  activeCycle?: boolean | undefined;
  updatedAt?:
    | {
    gt?: string | undefined;
    gte?: string | undefined;
    lt?: string | undefined;
    lte?: string | undefined;
    eq?: string | undefined;
      }
    | undefined;
  /**
   * Preferred createdAt comparator map. When provided, this takes precedence
   * over the legacy `createdBefore`/`createdAfter` params.
   */
  createdAt?:
    | {
    gt?: string | undefined;
    gte?: string | undefined;
    lt?: string | undefined;
    lte?: string | undefined;
    eq?: string | undefined;
      }
    | undefined;
  // Legacy params (pre-standardization); kept for back-compat with tests.
  createdBefore?: string | undefined; // ISO strings (already validated by caller)
  createdAfter?: string | undefined;
  orderBy?: 'createdAt' | 'updatedAt' | undefined;
  first?: number | undefined;
  after?: string | undefined;
  archived?: boolean | undefined;
};

type ListIssuesContext = {
  client: {
    ListIssues: (vars: ListIssuesQueryVariables) => Promise<ListIssuesQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * Fetch a (single page) list of issues using already-resolved canonical IDs.
 *
 * Phase 1 (Issue #169) limitations:
 *  - No automatic multi-page pagination (caller controls `first/after`).
 *  - No retry / rate limiting.
 *  - Accepts only canonical IDs (no name/slug resolution performed here).
 *  - Optional in-memory caching with short TTL.
 *
 * @param params Issue listing filters and pagination cursors.
 * @param params.teamIds Optional team IDs to filter by.
 * @param params.labelIds Optional label IDs to filter by.
 * @param params.stateIds Optional workflow state IDs to filter by.
 * @param params.assigneeId Optional user ID to filter by assignee.
 * @param params.delegateId Optional delegated agent user ID to filter by.
 * @param params.createdBefore Optional upper bound ISO timestamp for `createdAt`.
 * @param params.createdAfter Optional lower bound ISO timestamp for `createdAt`.
 * @param params.orderBy Field to order results by (`createdAt` or `updatedAt`).
 * @param params.first Page size to request from the API.
 * @param params.after Cursor for fetching the next page.
 * @param ctx Execution context including client and optional cache controls.
 * @param ctx.client Linear SDK subset providing the `ListIssues` operation.
 * @param ctx.cache Optional cache provider for short‑lived result caching.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL (in milliseconds) to use when storing the result in the cache.
 * @returns Array of issue nodes for the requested page.
 * @throws ApiRequestError When the underlying GraphQL request fails.
 */
export async function listIssues(
  params: ListIssuesParams,
  ctx: ListIssuesContext
): Promise<ListIssuesQuery['issues']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;

  // Compose a stable cache key where array parameters are order‑insensitive.
  // Arrays are sorted to avoid cache misses for the same logical filter set
  // provided in different orders.
  const cacheKey =
    !disableCache && cache
      ? `listIssues:${JSON.stringify([
          params.teamIds ? [...params.teamIds].sort() : null,
          params.labelIds ? [...params.labelIds].sort() : null,
          params.stateIds ? [...params.stateIds].sort() : null,
          params.assigneeId ?? null,
          params.delegateId ?? null,
          params.creatorId ?? null,
          params.parentId ?? null,
          // Include createdAt comparator map to avoid collisions when only createdAt differs
          params.createdAt ?? null,
          params.updatedAt ?? null,
          params.activeCycle ?? null,
          params.createdBefore ?? null,
          params.createdAfter ?? null,
          params.orderBy ?? null,
          params.first ?? null,
          params.after ?? null,
          params.archived ?? null,
        ])}`
      : undefined;

  if (cacheKey && cache) {
    const cached = cache.get<ListIssuesQuery['issues']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  // Build GraphQL filter from canonical IDs only
  const filter: Record<string, unknown> = {};
  /**
   * Helper to construct `relation: { id: { eq: <id> } }` blocks
   * for relation fields like assignee, delegate, creator, and parent.
   */
  const relationIdEq = (id?: string) => (id ? { id: { eq: id } } : undefined);
  if (params.teamIds && params.teamIds.length) {
    filter['team'] = { id: { in: params.teamIds } };
  }
  if (params.labelIds && params.labelIds.length) {
    filter['labels'] = { id: { in: params.labelIds } };
  }
  if (params.stateIds && params.stateIds.length) {
    filter['state'] = { id: { in: params.stateIds } };
  }
  const assignee = relationIdEq(params.assigneeId);
  if (assignee) filter['assignee'] = assignee;
  const delegate = relationIdEq(params.delegateId);
  if (delegate) filter['delegate'] = delegate;
  const creator = relationIdEq(params.creatorId);
  if (creator) filter['creator'] = creator;
  const parent = relationIdEq(params.parentId);
  if (parent) filter['parent'] = parent;
  if (params.createdAt) {
    filter['createdAt'] = params.createdAt;
  } else if (params.createdBefore || params.createdAfter) {
    const createdAt: Record<string, string> = {};
    if (params.createdBefore) createdAt['lt'] = params.createdBefore;
    if (params.createdAfter) createdAt['gt'] = params.createdAfter;
    filter['createdAt'] = createdAt;
  }
  if (params.updatedAt) {
    filter['updatedAt'] = params.updatedAt;
  }
  if (params.activeCycle) {
    filter['cycle'] = { isActive: { eq: true } };
  }
  if (params.archived) {
    // When requested, include archived issues by matching non-null archivedAt
    filter['archivedAt'] = { null: false };
  }

  try {
    const resp = await client.ListIssues({
      // Always send a filter object for parity with legacy command behaviour
      filter,
      ...(params.first !== undefined ? { first: params.first } : {}),
      ...(params.after !== undefined ? { after: params.after } : {}),
      ...(params.orderBy !== undefined
        ? { orderBy: params.orderBy as PaginationOrderBy }
        : {}),
    });

    const nodes = resp.issues.nodes;
    if (cacheKey && cache) {
      cache.set(cacheKey, nodes, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return nodes;
  } catch (err) {
    throw new ApiRequestError('Failed to list issues', err);
  }
}

// No default export – keep public API purely named.
