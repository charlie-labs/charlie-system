import {
  type GetUsersQuery,
  type GetUsersQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../../lib/cache/cache-provider.js';
import { listUsers } from '../../../lib/operations/user/list-users.js';
import { ResolutionError } from '../errors/resolution-error.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Context required to resolve a user reference to a UUID. */
interface ResolveUserIdContext {
  client: {
    GetUsers: (vars: GetUsersQueryVariables) => Promise<GetUsersQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
}

/**
 * Resolve a user reference (UUID, email, or name) to a user ID.
 *
 * - UUID-like inputs are returned as-is.
 * - Exact, case-insensitive matches on `name` or `email` are preferred.
 * - If no exact match is found, a simple fuzzy pass checks the first token of the name.
 *
 * @param value User identifier: UUID, email, or display name. Empty/undefined values return `undefined`.
 * @param ctx Execution context providing a Linear SDK client (with `GetUsers`) and optional cache controls.
 * @returns Resolved user ID string, or `undefined` when `value` is empty.
 * @throws ResolutionError When multiple users match the input ambiguously.
 * @throws ResolutionError When no user matches the input.
 */
export async function resolveUserId(
  value: string | undefined,
  ctx: ResolveUserIdContext
): Promise<string | undefined> {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Normalization: treat leading "@" as cosmetic (e.g., "@charlie" → "charlie").
  // Only strip a single leading at-sign to avoid altering emails like "a@b.com".
  const normalized = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  const inputLabel =
    normalized === trimmed
      ? `"${trimmed}"`
      : `"${trimmed}" (normalized: "${normalized}")`;

  if (uuidV4.test(normalized)) return normalized;
  const users = await listUsers(
    {},
    {
      client: ctx.client,
      ...(ctx.cache !== undefined ? { cache: ctx.cache } : {}),
      ...(ctx.disableCache !== undefined
        ? { disableCache: ctx.disableCache }
        : {}),
    }
  );
  const lower = normalized.toLowerCase();
  const exact = users.find(
    (u) => u.name.toLowerCase() === lower || u.email.toLowerCase() === lower
  );
  if (exact) return exact.id;
  const fuzzyMatches = users.filter(
    (u) => u.name.split(/\s+/)[0]?.toLowerCase() === lower
  );
  if (fuzzyMatches.length === 1) return fuzzyMatches[0]!.id;
  if (fuzzyMatches.length > 1) {
    const possibilities = fuzzyMatches
      .map((u) => `${u.name} (${u.id})`)
      .join(', ');
    throw new ResolutionError(
      `Ambiguous user reference ${inputLabel}. Possible matches: ${possibilities}. Provide a more specific identifier.`
    );
  }
  throw new ResolutionError(
    `Unable to resolve user ${inputLabel}. Provide a valid UUID, full name, or unique email.`
  );
}
