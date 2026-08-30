/**
 * Get an environment variable.
 *
 * @param name The name of the environment variable to read (for example, "LINEAR_API_KEY").
 * @returns The variable value as a string when set, or `undefined` when the variable is not defined.
 */
function getEnv(name: string): string | undefined {
  return process.env[name]; // eslint-disable-line no-process-env
}

function getNonEmptyTrimmedEnv(name: string): string | undefined {
  const value = getEnv(name);
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

/**
 * Get a required Linear API Authorization header value.
 *
 * Precedence:
 * 1. `LINEAR_ACCESS_TOKEN` (raw OAuth token) → `Bearer <token>`
 * 2. `LINEAR_API_KEY` (personal API key) → `<key>` (no Bearer prefix)
 *
 * @returns A value suitable for the `Authorization` header.
 * @throws Error If neither `LINEAR_ACCESS_TOKEN` nor `LINEAR_API_KEY` is set.
 */
export function requireLinearAuthHeaderValueFromEnv(): string {
  const accessToken = getNonEmptyTrimmedEnv('LINEAR_ACCESS_TOKEN');
  if (accessToken) {
    return `Bearer ${accessToken}`;
  }

  const apiKey = getNonEmptyTrimmedEnv('LINEAR_API_KEY');
  if (apiKey) {
    return apiKey;
  }

  throw new Error(
    'Required environment variable LINEAR_ACCESS_TOKEN or LINEAR_API_KEY is not set'
  );
}

/**
 * Resolve a Linear API Authorization header value.
 *
 * Precedence:
 * 1. `args.accessToken` (raw OAuth token) → `Bearer <token>`
 * 2. `args.apiKey` (personal API key) → `<key>` (no Bearer prefix)
 * 3. Environment variables (see {@link requireLinearAuthHeaderValueFromEnv})
 */
export function resolveLinearAuthHeaderValue(args?: {
  accessToken?: string;
  apiKey?: string;
}): string {
  const accessToken = args?.accessToken?.trim();
  if (accessToken && accessToken.length > 0) {
    return `Bearer ${accessToken}`;
  }

  const apiKey = args?.apiKey?.trim();
  if (apiKey && apiKey.length > 0) {
    return apiKey;
  }

  return requireLinearAuthHeaderValueFromEnv();
}
