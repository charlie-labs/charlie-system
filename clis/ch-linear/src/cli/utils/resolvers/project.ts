import {
  type GetProjectsQuery,
  type GetProjectsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../../lib/cache/cache-provider.js';
import { listProjects } from '../../../lib/operations/project/list-projects.js';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Context required to resolve a project reference to a UUID. */
interface ResolveProjectIdContext {
  client: {
    GetProjects: (vars: GetProjectsQueryVariables) => Promise<GetProjectsQuery>;
  };
  cache?: CacheProvider;
  disableCache?: boolean;
}

/**
 * Resolve a project reference (UUID or exact name) to a project ID.
 *
 * - UUID-like inputs are returned as-is.
 * - Name lookups are case-insensitive and require an exact match.
 *
 * @param value Project identifier: UUID or name. Empty/undefined values return `undefined`.
 * @param ctx Execution context providing a Linear SDK client (with `GetProjects`) and optional cache controls.
 * @returns Resolved project ID string, or `undefined` when `value` is empty or no project matches by name.
 */
export async function resolveProjectId(
  value: string | undefined,
  ctx: ResolveProjectIdContext
): Promise<string | undefined> {
  if (!value) return undefined;
  if (uuidV4.test(value)) return value;
  const projects = await listProjects(
    {},
    {
      client: ctx.client,
      ...(ctx.cache !== undefined ? { cache: ctx.cache } : {}),
      ...(ctx.disableCache !== undefined
        ? { disableCache: ctx.disableCache }
        : {}),
    }
  );
  const lower = value.toLowerCase();
  const match = projects.find((p) => p.name.toLowerCase() === lower);
  return match?.id;
}
