import {
  type GetDocumentQuery,
  type GetDocumentQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { DEFAULT_TTL_MS } from '../../cache/default-ttl-ms.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type GetDocumentParams = {
  id: string;
};

type GetDocumentContext = {
  client: {
    GetDocument: (vars: GetDocumentQueryVariables) => Promise<GetDocumentQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
  cacheTtlMs?: number;
};

export async function getDocument(
  params: GetDocumentParams,
  ctx: GetDocumentContext
): Promise<NonNullable<GetDocumentQuery['document']>> {
  const { client, cache, disableCache, cacheTtlMs } = ctx;
  const cacheKey =
    !disableCache && cache ? `getDocument:${params.id}` : undefined;
  if (cacheKey && cache) {
    const cached =
      cache.get<NonNullable<GetDocumentQuery['document']>>(cacheKey);
    if (cached) return cached;
  }

  try {
    const { document } = await client.GetDocument({ id: params.id });
    if (!document) throw new NotFoundError('document', params.id);
    if (cacheKey && cache) {
      cache.set(cacheKey, document, cacheTtlMs ?? DEFAULT_TTL_MS);
    }
    return document;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to fetch document', err);
  }
}
