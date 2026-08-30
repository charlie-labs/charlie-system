import { getOrSet } from '../../../lib/cache/index.js';
import { NotFoundError, ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an optional issue reference (identifier or UUID) to a Linear issue UUID.
 *
 * @param value - Issue reference (identifier like `ENG-123`, UUID, or `undefined`).
 * @returns The resolved issue UUID, or `undefined` when no value was provided.
 * @throws {ValidationError} If the provided value is an empty/whitespace-only string.
 * @throws {NotFoundError} If the issue cannot be resolved.
 */
export async function resolveIssueId(
  value: string | undefined
): Promise<string | undefined> {
  if (!value) return undefined;
  return resolveIssueIdRequired(value);
}

/**
 * Resolve a required issue reference (identifier or UUID) to a Linear issue UUID.
 *
 * @param value - Issue reference (identifier like `ENG-123` or UUID).
 * @returns The resolved issue UUID.
 * @throws {ValidationError} If the provided value is an empty/whitespace-only string.
 * @throws {NotFoundError} If the issue cannot be resolved.
 */
export async function resolveIssueIdRequired(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(
      'Issue reference must include at least one character.'
    );
  }
  if (uuidV4.test(trimmed)) return trimmed;
  const cacheKey = `issue:${trimmed.toUpperCase()}` as const;
  return getOrSet(cacheKey, async () => {
    const linear = getLinearSdk();
    const { searchIssues } = await linear.SearchIssues({
      term: trimmed,
      first: 10,
    });
    const match = searchIssues.nodes.find(
      (n) => n.identifier.toUpperCase() === trimmed.toUpperCase()
    );
    if (!match) {
      throw new NotFoundError('Issue', trimmed);
    }
    return match.id;
  });
}
