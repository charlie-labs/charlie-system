import {
  type GetInitiativeQuery,
  type GetInitiativeQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type GetInitiativeParams = {
  id: string;
};

type GetInitiativeContext = {
  client: {
    GetInitiative: (
      vars: GetInitiativeQueryVariables
    ) => Promise<GetInitiativeQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

/**
 * Fetch a single Linear initiative by its id, optionally using the short-lived cache.
 *
 * @param params.id The initiative id to retrieve.
 * @param ctx.client Linear SDK subset exposing `GetInitiative`.
 * @param ctx.cache Optional cache provider to store/retrieve the initiative.
 * @param ctx.disableCache When true, bypasses the cache even if provided.
 * @param ctx.cacheTtlMs Optional TTL override (ms) for cache writes (defaults to DEFAULT_TTL_MS).
 * @returns The requested initiative object.
 * @throws NotFoundError When no initiative exists for the given id.
 * @throws ApiRequestError For transport or other unexpected request failures.
 */
export async function getInitiative(
  params: GetInitiativeParams,
  ctx: GetInitiativeContext
): Promise<NonNullable<GetInitiativeQuery['initiative']>> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const cacheKey =
    !disableCache && cache ? `getInitiative:${params.id}` : undefined;
  if (cacheKey && cache) {
    const cached =
      cache.get<NonNullable<GetInitiativeQuery['initiative']>>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { initiative } = await client.GetInitiative({ id: params.id });
    if (!initiative) throw new NotFoundError('initiative', params.id);
    if (cacheKey && cache) {
      cache.set(cacheKey, initiative, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return initiative;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to fetch initiative', err);
  }
}
