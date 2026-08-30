import {
  type GetIssueQuery,
  type GetIssueQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type GetIssueParams = {
  id: string; // canonical issue ID (UUID)
};

type GetIssueContext = {
  client: {
    GetIssue: (vars: GetIssueQueryVariables) => Promise<GetIssueQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * Fetch a single issue by canonical ID.
 *
 * Phase 1 notes (Issue #169):
 *  - Throws `NotFoundError` when the issue is absent.
 *  - No retries / rate limiting.
 *  - Optional short-lived in-memory caching.
 *
 * @param params Issue lookup parameters.
 * @param params.id Canonical Linear issue UUID.
 * @param ctx Execution context used to perform the request and optionally cache the result.
 * @param ctx.client Linear SDK subset providing the `GetIssue` operation.
 * @param ctx.cache Optional cache provider for short‑lived result caching.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL (in milliseconds) to use when storing the result in the cache.
 * @returns The fetched issue object.
 * @throws NotFoundError When the requested issue does not exist.
 * @throws ApiRequestError When the underlying GraphQL request fails for any other reason.
 */
export async function getIssue(
  params: GetIssueParams,
  ctx: GetIssueContext
): Promise<NonNullable<GetIssueQuery['issue']>> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const cacheKey = !disableCache && cache ? `getIssue:${params.id}` : undefined;

  if (cacheKey && cache) {
    const cached = cache.get<NonNullable<GetIssueQuery['issue']>>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { issue } = await client.GetIssue({ id: params.id });
    if (!issue) {
      throw new NotFoundError('issue', params.id);
    }
    if (cacheKey && cache) {
      cache.set(cacheKey, issue, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return issue;
  } catch (err) {
    if (err instanceof NotFoundError) throw err; // pass through
    throw new ApiRequestError('Failed to fetch issue', err);
  }
}

// No default export – keep public API purely named.
