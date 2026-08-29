import {
  type GetProjectQuery,
  type GetProjectQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type GetProjectParams = {
  id: string;
};

type GetProjectContext = {
  client: {
    GetProject: (vars: GetProjectQueryVariables) => Promise<GetProjectQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * Retrieve a Linear project by id, optionally leveraging the short-lived cache.
 *
 * @param params.id The project id to fetch.
 * @param ctx.client Linear SDK subset exposing `GetProject`.
 * @param ctx.cache Optional cache provider for read-through caching.
 * @param ctx.disableCache When true, skips cache lookups/writes.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to {@link DEFAULT_TTL_MS}).
 * @returns The requested project object.
 * @throws NotFoundError When the project cannot be found.
 * @throws ApiRequestError For transport or unexpected request failures.
 */
export async function getProject(
  params: GetProjectParams,
  ctx: GetProjectContext
): Promise<NonNullable<GetProjectQuery['project']>> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const cacheKey =
    !disableCache && cache ? `getProject:${params.id}` : undefined;
  if (cacheKey && cache) {
    const cached = cache.get<NonNullable<GetProjectQuery['project']>>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { project } = await client.GetProject({ id: params.id });
    if (!project) {
      throw new NotFoundError('project', params.id);
    }
    if (cacheKey && cache) {
      cache.set(cacheKey, project, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return project;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to fetch project', err);
  }
}
