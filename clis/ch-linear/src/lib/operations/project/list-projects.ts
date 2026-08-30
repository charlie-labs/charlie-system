import {
  type GetProjectsQuery,
  type GetProjectsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { DEFAULT_PAGE_SIZE } from '../../pagination/default-page-size.js';

type ListProjectsParams = {
  teamId?: string | undefined;
  statusType?: string | undefined;
  initiativeId?: string | undefined;
  /**
   * Maximum number of projects to request from the server (used as `first`).
   * When omitted, a small default page size is used.
   */
  limit?: number | undefined;
};

type ListProjectsContext = {
  client: {
    GetProjects: (vars: GetProjectsQueryVariables) => Promise<GetProjectsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * List projects using a single server request.
 *
 * Notes:
 * - Issues exactly one `GetProjects` call with `first = params.limit ?? DEFAULT_PAGE_SIZE`.
 * - Does not iterate when additional pages exist; callers needing more items should pass a larger `limit`.
 * - Enforces the requested page size locally (the `first` value) before caching/returning to guard against servers that ignore it.
 *
 * @param params Project listing filters and optional `limit` (used as `first`).
 * @param params.teamId Optional team scope filter.
 * @param params.statusType Optional status type filter.
 * @param params.initiativeId Optional initiative filter.
 * @param params.limit Optional maximum number of items to request/return.
 * @param ctx Execution context including the client and cache controls.
 * @param ctx.client Linear SDK subset providing the `GetProjects` operation.
 * @param ctx.cache Optional cache provider for short‑lived result caching.
 * @param ctx.disableCache When true, bypasses the cache entirely.
 * @param ctx.cacheTtlMs Optional TTL (in milliseconds) to use when storing the result in the cache.
 * @returns The first page of matching project nodes, trimmed to at most the requested page size.
 * @throws ApiRequestError If the underlying request fails.
 */
export async function listProjects(
  params: ListProjectsParams,
  ctx: ListProjectsContext
): Promise<GetProjectsQuery['projects']['nodes']> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const first = params.limit ?? DEFAULT_PAGE_SIZE;

  const cacheKey =
    !disableCache && cache
      ? `listProjects:${JSON.stringify([
          params.teamId,
          params.statusType,
          params.initiativeId,
          first,
        ])}`
      : undefined;

  if (cacheKey && cache) {
    const cached = cache.get<GetProjectsQuery['projects']['nodes']>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { projects } = await client.GetProjects({
      first,
      ...(params.teamId !== undefined ? { teamId: params.teamId } : {}),
      ...(params.statusType !== undefined
        ? { statusType: params.statusType }
        : {}),
      ...(params.initiativeId !== undefined
        ? { initiativeId: params.initiativeId }
        : {}),
    });
    const nodes = projects.nodes ?? [];
    // Always enforce the requested cap locally based on the `first` value
    // actually sent to the server to guard against backends that ignore it.
    const result = nodes.slice(0, first);
    if (cacheKey && cache) {
      cache.set(cacheKey, result, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return result;
  } catch (err) {
    throw new ApiRequestError('Failed to list projects', err);
  }
}

// No default export – keep public API purely named.
