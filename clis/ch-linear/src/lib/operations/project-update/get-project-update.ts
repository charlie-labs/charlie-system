import {
  type GetProjectUpdateQuery,
  type GetProjectUpdateQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type GetProjectUpdateParams = { id: string };

type GetProjectUpdateContext = {
  client: {
    GetProjectUpdate: (
      vars: GetProjectUpdateQueryVariables
    ) => Promise<GetProjectUpdateQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/** Fetch a single ProjectUpdate by ID, with short-lived caching. */
export async function getProjectUpdate(
  params: GetProjectUpdateParams,
  ctx: GetProjectUpdateContext
): Promise<NonNullable<GetProjectUpdateQuery['projectUpdate']>> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const cacheKey =
    !disableCache && cache ? `getProjectUpdate:${params.id}` : undefined;

  if (cacheKey && cache) {
    const cached =
      cache.get<NonNullable<GetProjectUpdateQuery['projectUpdate']>>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { projectUpdate } = await client.GetProjectUpdate({ id: params.id });
    if (!projectUpdate) throw new NotFoundError('project update', params.id);
    if (cacheKey && cache) {
      cache.set(cacheKey, projectUpdate, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return projectUpdate;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to fetch project update', err);
  }
}

// No default export – keep public API purely named.
