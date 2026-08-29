import { type Sdk } from '../../generated/linear-sdk.js';
import { createLinearClient } from '../client/create-client.js';
import { resolveLinearAuthHeaderValue } from './env.js';

let linear: Sdk | undefined;
let activeConfig:
  | { authorizationHeaderValue: string; endpoint: string }
  | undefined;

/**
 * Get a process-local Linear SDK instance.
 *
 * - Returns a cached SDK instance created on the first call.
 * - Subsequent calls must pass the same `accessToken`/`apiKey`/`endpoint`
 *   configuration; if a different configuration is requested, an error is
 *   thrown to surface the misconfiguration. Callers that need a custom client
 *   should use `createLinearClient` directly.
 * - Intended for production use. Tests should inject SDK stubs via command-level
 *   dependency injection rather than relying on global overrides.
 *
 * @param args Optional configuration overrides for the SDK.
 * @param args.accessToken Linear OAuth access token.
 * @param args.apiKey Linear personal API key.
 * @param args.endpoint GraphQL endpoint URL. When omitted on the first call, the
 *   default `https://api.linear.app/graphql` is used.
 * @returns A cached Linear SDK instance.
 * @throws Error If an SDK was already created with a different `accessToken`,
 *   `apiKey`, or `endpoint`. Use `createLinearClient` to construct a dedicated
 *   client when a different configuration is required.
 */
export function getLinearSdk(args?: {
  accessToken?: string;
  apiKey?: string;
  endpoint?: string;
}): Sdk {
  const effectiveEndpoint = args?.endpoint ?? 'https://api.linear.app/graphql';
  const effectiveAuthorizationHeaderValue = resolveLinearAuthHeaderValue({
    ...(args?.accessToken !== undefined
      ? { accessToken: args.accessToken }
      : {}),
    ...(args?.apiKey !== undefined ? { apiKey: args.apiKey } : {}),
  });

  const requestedAccessToken = args?.accessToken?.trim();
  const requestedApiKey = args?.apiKey?.trim();
  const requestedAuthorizationHeaderValue =
    requestedAccessToken && requestedAccessToken.length > 0
      ? `Bearer ${requestedAccessToken}`
      : requestedApiKey && requestedApiKey.length > 0
        ? requestedApiKey
        : undefined;

  if (!linear) {
    linear = createLinearClient({
      ...(args?.accessToken !== undefined
        ? { accessToken: args.accessToken }
        : {}),
      ...(args?.apiKey !== undefined ? { apiKey: args.apiKey } : {}),
      endpoint: effectiveEndpoint,
    });
    activeConfig = {
      authorizationHeaderValue: effectiveAuthorizationHeaderValue,
      endpoint: effectiveEndpoint,
    };
    return linear;
  }

  const mismatch = Boolean(
    (requestedAuthorizationHeaderValue !== undefined &&
      requestedAuthorizationHeaderValue !==
        activeConfig?.authorizationHeaderValue) ||
      (args?.endpoint !== undefined && args.endpoint !== activeConfig?.endpoint)
  );
  if (mismatch) {
    throw new Error(
      'getLinearSdk was already initialized with a different configuration. ' +
        'Create a dedicated client via createLinearClient for custom settings, or restart the process.'
    );
  }
  return linear;
}
