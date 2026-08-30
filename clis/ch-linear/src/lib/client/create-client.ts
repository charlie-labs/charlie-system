import { GraphQLClient } from 'graphql-request';

import { getSdk, type Sdk } from '../../generated/linear-sdk.js';
import { resolveLinearAuthHeaderValue } from '../linear/env.js';

/**
 * Factory for constructing a Linear GraphQL SDK instance.
 *
 * Phase 1 (Issue #169):
 *  - Reads environment variables directly (no injection layer yet).
 *  - No retry / rate limiting – raw requests only.
 *  - Stateless; callers may cache the returned instance if desired.
 *
 * @param args Optional overrides.
 * @param args.accessToken Linear OAuth access token. When provided, it is sent as `Authorization: Bearer <token>`.
 * @param args.apiKey Linear personal API key. When provided, it is sent as `Authorization: <key>` (no Bearer prefix).
 * @param args.endpoint GraphQL endpoint URL. Defaults to `https://api.linear.app/graphql`.
 * @returns A typed Linear GraphQL SDK instance that exposes the generated query/mutation methods.
 * @throws Error If neither `LINEAR_ACCESS_TOKEN` nor `LINEAR_API_KEY` is set and no explicit auth is provided.
 */
export function createLinearClient(args?: {
  accessToken?: string;
  apiKey?: string;
  endpoint?: string;
}): Sdk {
  const authorization = resolveLinearAuthHeaderValue({
    ...(args?.accessToken !== undefined
      ? { accessToken: args.accessToken }
      : {}),
    ...(args?.apiKey !== undefined ? { apiKey: args.apiKey } : {}),
  });
  const endpoint = args?.endpoint ?? 'https://api.linear.app/graphql';
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: authorization },
  });
  return getSdk(client);
}

export type LinearClient = Sdk; // alias for external consumers

// No default export – keep public API purely named.
