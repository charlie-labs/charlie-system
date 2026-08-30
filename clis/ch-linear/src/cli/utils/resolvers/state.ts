import { type GetWorkflowStatesQuery } from '../../../generated/linear-sdk.js';
import { getWorkflowStates } from '../../../lib/linear/cache-loaders.js';

type StatesProvider = () => Promise<
  GetWorkflowStatesQuery['workflowStates']['nodes']
>;

/**
 * Select the workflow-states provider in a single place (DI param → test seam → cache loader).
 * Keep this helper local to avoid expanding the public API surface.
 */
function selectGetStates(deps?: {
  getStates?: StatesProvider;
}): StatesProvider {
  return (
    deps?.getStates ??
    globalThis.CH_LINEAR_TEST_WORKFLOW_STATES ??
    getWorkflowStates
  );
}

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a single workflow state reference (name or ID) to a single state ID.
 *
 * Behaviour:
 * - UUID-like inputs are passed through unchanged.
 * - Non-UUID inputs are matched case-insensitively against state names.
 * - When `options.teamIds` is provided, matches are restricted to the given
 *   team(s). The first matching state across those teams is returned.
 */
export async function resolveStateId(
  value: string | undefined,
  options: { teamIds?: string[] } = {},
  deps: { getStates?: StatesProvider } = {}
): Promise<string | undefined> {
  if (!value) return undefined;
  if (uuidV4.test(value)) return value;

  // Obtain the workflow states provider via the standard selection order.
  const getStatesFn = selectGetStates(deps);

  const states = await getStatesFn();
  const lower = value.toLowerCase();

  const { teamIds } = options;
  const filtered =
    teamIds && teamIds.length
      ? states.filter((s) => s.team && teamIds.includes(s.team.id))
      : states;

  const match = filtered.find((s) => s.name.toLowerCase() === lower);
  return match?.id;
}

/**
 * Resolve one or more workflow state references (names and/or IDs) to a
 * de-duplicated list of state IDs. When names are provided, all matching
 * states across the workspace are returned by default. When `teamIds` are
 * provided, matches are limited to those teams.
 *
 * Examples:
 *   resolveWorkflowStateIds(['Done'])               // ⇒ [doneIdTeamA, doneIdTeamB, ...]
 *   resolveWorkflowStateIds(['Done'], { teamIds })  // ⇒ [doneIdOnlyWithinTeams]
 *   resolveWorkflowStateIds(['uuid-raw'])           // ⇒ ['uuid-raw']
 */
export async function resolveWorkflowStateIds(
  values: string[] | undefined,
  options: { teamIds?: string[] } = {},
  deps: { getStates?: StatesProvider } = {}
): Promise<string[] | undefined> {
  if (!values || values.length === 0) return undefined;

  // Separate UUIDs from names to avoid unnecessary lookups.
  const directIds = values.filter((v) => uuidV4.test(v));
  const names = values.filter((v) => !uuidV4.test(v));

  const resolvedFromNames: string[] = [];
  if (names.length > 0) {
    const getStatesFn = selectGetStates(deps);

    const states = await getStatesFn();
    const { teamIds } = options;
    const pool =
      teamIds && teamIds.length
        ? states.filter((s) => s.team && teamIds.includes(s.team.id))
        : states;

    const byLowerName = new Map<string, string[]>();
    for (const s of pool) {
      const key = s.name.toLowerCase();
      const arr = byLowerName.get(key) ?? [];
      arr.push(s.id);
      byLowerName.set(key, arr);
    }

    for (const name of names) {
      const ids = byLowerName.get(name.toLowerCase());
      if (ids && ids.length) resolvedFromNames.push(...ids);
    }
  }

  const out = Array.from(new Set([...directIds, ...resolvedFromNames]));
  return out.length ? out : undefined;
}

/**
 * Find the first workflow state ID matching the given type, optionally scoped to a team.
 * If a teamId is provided, prefers a state of that type within the team; otherwise falls back
 * to the first state of that type across all teams.
 */
export async function findFirstWorkflowStateId(
  type: 'unstarted' | 'completed',
  teamId?: string
): Promise<string | undefined> {
  const states = await getWorkflowStates();

  if (teamId) {
    const match = states.find((s) => s.type === type && s.team?.id === teamId);
    if (match) return match.id;
  }

  const fallback = states.find((s) => s.type === type);
  return fallback?.id;
}

/** Return the team ID for a given workflow state ID, if any. */
export async function getTeamIdForStateId(
  stateId: string | undefined
): Promise<string | undefined> {
  if (!stateId) return undefined;
  const states = await getWorkflowStates();
  const found = states.find((s) => s.id === stateId);
  return found?.team?.id;
}
