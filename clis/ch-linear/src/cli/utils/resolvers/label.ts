import {
  type GetIssueLabelsQuery,
  type GetIssueLabelsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../../lib/cache/cache-provider.js';
import { listLabels } from '../../../lib/operations/label/list-labels.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Context required to resolve label IDs. */
interface ResolveLabelIdsContext {
  client: {
    GetIssueLabels: (
      vars: GetIssueLabelsQueryVariables
    ) => Promise<GetIssueLabelsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
}

/**
 * Resolve a list of label references (names or UUIDs) to label IDs.
 *
 * - UUID-like inputs are passed through unchanged.
 * - Non-UUID inputs are matched case-insensitively against existing label names.
 * - When `options.errorOnNotFound` is true, any name that cannot be resolved
 *   triggers an error.
 *
 * @param values Optional array of label values (name or UUID). When omitted or empty, `undefined` is returned.
 * @param options.errorOnNotFound If true, throw when a name cannot be matched to a label.
 * @param ctx Execution context providing a Linear SDK client (with `GetIssueLabels`) and optional cache controls.
 * @returns Array of resolved label IDs, or `undefined` when no values are provided or none resolve.
 * @throws Error When `errorOnNotFound` is set and a label name cannot be resolved.
 */
export async function resolveLabelIds(
  values: string[] | undefined,
  options: { errorOnNotFound?: boolean } = {},
  ctx: ResolveLabelIdsContext
): Promise<string[] | undefined> {
  if (!values || values.length === 0) return undefined;
  if (values.every((v) => uuidV4.test(v))) return values;
  const labels = await listLabels(
    {},
    {
      client: ctx.client,
      ...(ctx.cache !== undefined ? { cache: ctx.cache } : {}),
      ...(ctx.disableCache !== undefined
        ? { disableCache: ctx.disableCache }
        : {}),
    }
  );
  const resolved: string[] = [];
  for (const val of values) {
    if (uuidV4.test(val)) {
      resolved.push(val);
      continue;
    }
    const match = labels.find(
      (l) => l.name.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      resolved.push(match.id);
    } else if (options.errorOnNotFound) {
      throw new Error(
        `Unable to resolve label "${val}". Please ensure the label exists or provide a valid ID.`
      );
    }
  }
  return resolved.length ? resolved : undefined;
}
