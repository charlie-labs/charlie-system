import {
  type GetInitiativesQuery,
  type GetProjectsQuery,
  type GetWorkflowStatesQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type CacheProvider } from '../../cache/cache-provider.js';
import { mapWithConcurrency } from '../../utils/concurrency.js';
import { listInitiatives } from '../initiative/list-initiatives.js';
import { listLabels as listIssueLabels } from '../label/list-labels.js';
import { listProjectLabels } from '../label/list-project-labels.js';
import { listProjects } from '../project/list-projects.js';
import { listTeams } from '../team/list-teams.js';
// No need to list projects separately; we consume projects via the
// `GetInitiatives` nested `projects` connection added in PR #266.
import { listWorkflowStates } from '../workflow-state/list-workflow-states.js';

// Per review: it's OK to ignore initiatives after the first 50.
// Fetch them in a single request and do not paginate further.
const MAX_INITIATIVES = 50 as const;

// Page size for bounded follow-up fetches of initiative.projects
const INITIATIVE_PROJECTS_PAGE_SIZE = 20 as const;

// Maximum number of projects to include per initiative in the overview.
// Tunable knob used in selection logic below.
// Per review: include the top 20 projects per initiative
const MAX_PROJECTS_PER_INITIATIVE = 20 as const;

// Concurrency for follow-up initiative.projects page fetch + shaping
const INITIATIVE_FOLLOWUP_CONCURRENCY = 12 as const;

// Output shapes (match issue #262)
function isNotNullOrUndefined<T>(v: T | null | undefined): v is T {
  return v != null;
}

type TeamView = {
  name: string;
  key: string;
  issueStatuses: string[];
};

type ProjectView = {
  name: string;
  status: string;
  priority: number | null;
  leadName: string | null;
  completedAt: string | null;
  description?: string;
};

type InitiativeView = {
  name: string;
  description?: string;
  projects: ProjectView[];
};

type IssueLabelsView = {
  global: string[];
  byTeam: {
    team: { name: string; key: string };
    labels: string[];
  }[];
};

/**
 * WorkspaceOverview: a compact representation of workspace metadata for the
 * `workspace overview` command and programmatic consumption.
 *
 * Notes:
 * - This shape intentionally omits `id` fields and represents labels as
 *   plain string names, per review guidance.
 */
export type WorkspaceOverview = {
  teams: TeamView[];
  initiatives: InitiativeView[];
  projectLabels: string[];
  issueLabels: IssueLabelsView;
  /**
   * Optional fallback: when there are no active initiatives, include a
   * curated list of currently active projects (started/planned), sorted by
   * priority asc then updatedAt desc and capped to 20. Present only when
   * `initiatives` is empty.
   */
  activeProjects?: ProjectView[];
};

type Ctx = {
  client: Pick<
    Sdk,
    | 'GetTeams'
    | 'GetInitiatives'
    | 'GetWorkflowStates'
    | 'GetIssueLabels'
    | 'GetProjectLabels'
    | 'GetInitiativeProjects'
    | 'GetProjects'
  >;
  cache?: CacheProvider;
};

type ProjectNode = NonNullable<
  NonNullable<
    GetInitiativesQuery['initiatives']['nodes'][number]
  >['projects']['nodes'][number]
>;
type WorkflowStateNode = NonNullable<
  GetWorkflowStatesQuery['workflowStates']['nodes'][number]
>;

/**
 * Compose a workspace-level overview including teams, workflow states,
 * active initiatives (with nested projects), and both project and issue labels.
 * Results are stably sorted and deduplicated. Designed to execute under
 * Linear's GraphQL complexity limits with bounded pagination.
 *
 * When there are no active initiatives, includes an `activeProjects` fallback
 * (top started/planned projects, sorted by priority asc then updatedAt desc,
 * capped to 20). This keeps CLI and programmatic outputs consistent.
 *
 * @param ctx Resolved Linear SDK client and optional cache provider.
 * @returns The composed workspace overview.
 */
export async function getWorkspaceOverview(
  ctx: Ctx
): Promise<WorkspaceOverview> {
  const { client, cache } = ctx;
  const operationContext =
    cache !== undefined ? { client, cache } : { client };

  const [teams, workflowStates, initiativesResp, issueLbls, projectLbls] =
    await Promise.all([
      listTeams({}, operationContext),
      listWorkflowStates({}, operationContext),
      // Single-page fetch via helper (preserves caching): request up to 50.
      listInitiatives(
        { limit: MAX_INITIATIVES, pageSize: MAX_INITIATIVES },
        operationContext
      ),
      listIssueLabels({}, operationContext),
      listProjectLabels({}, operationContext),
    ]);

  // Build per-team workflow status names ordered by position asc, unique by name
  const statesByTeam = new Map<string, WorkflowStateNode[]>();
  const wsNodes = (workflowStates ?? []).filter(isNotNullOrUndefined);
  for (const s of wsNodes) {
    if (!s?.team) continue;
    const arr = statesByTeam.get(s.team.id) ?? [];
    arr.push(s);
    statesByTeam.set(s.team.id, arr);
  }
  const statusNamesByTeam = new Map<string, string[]>();
  for (const [teamId, arr] of statesByTeam.entries()) {
    const sorted = arr
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const names = sorted.map((s) => s.name);
    statusNamesByTeam.set(teamId, Array.from(new Set(names)));
  }

  const teamViews: TeamView[] = teams
    .filter(isNotNullOrUndefined)
    .map((t) => ({
      name: t.name,
      key: t.key,
      issueStatuses: statusNamesByTeam.get(t.id) ?? [],
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

  // Active initiatives: treat those without completedAt as active
  const initiativesFiltered = initiativesResp.filter(isNotNullOrUndefined);
  const initiativesActive = initiativesFiltered.filter((i) => !i.completedAt);

  function projectViewFrom(p: ProjectNode): ProjectView {
    const statusName = p?.status?.name ?? '';
    const lead = p?.lead;
    const leadName = lead?.displayName ?? lead?.name ?? null;
    return {
      name: p.name,
      status: statusName ?? '',
      priority: typeof p.priority === 'number' ? p.priority : null,
      leadName,
      completedAt: p?.completedAt ?? null,
      // Include when fetched via GraphQL (optional)
      description: p?.description ?? undefined,
    };
  }

  function sortActive(a: ProjectNode, b: ProjectNode): number {
    // priority asc (nulls last), then updatedAt desc
    const pa =
      typeof a.priority === 'number' ? a.priority : Number.POSITIVE_INFINITY;
    const pb =
      typeof b.priority === 'number' ? b.priority : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return ub - ua;
  }
  function sortCompleted(a: ProjectNode, b: ProjectNode): number {
    const ca = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const cb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    if (cb !== ca) return cb - ca; // desc
    const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return ub - ua;
  }

  // Limit initiatives to the top 50 via listInitiatives(limit=MAX_INITIATIVES),
  // then filter to active and sort by name for stable presentation
  const initiativeViews: InitiativeView[] = await mapWithConcurrency(
    initiativesActive
      .slice()
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    INITIATIVE_FOLLOWUP_CONCURRENCY,
    async (i) => {
      let projNodes = (i.projects?.nodes ?? []).filter(isNotNullOrUndefined);

      // If we don't have enough to confidently select the top N and there are more pages,
      // fetch one additional page (bounded) to improve accuracy.
      const nextPageInfo = i.projects?.pageInfo;
      if (
        projNodes.length < MAX_PROJECTS_PER_INITIATIVE &&
        nextPageInfo?.hasNextPage &&
        i.id
      ) {
        try {
          const { initiative } = await client.GetInitiativeProjects({
            id: i.id,
            first: INITIATIVE_PROJECTS_PAGE_SIZE,
            ...(nextPageInfo.endCursor !== undefined &&
            nextPageInfo.endCursor !== null
              ? { after: nextPageInfo.endCursor }
              : {}),
          });
          const extra =
            initiative?.projects?.nodes?.filter(isNotNullOrUndefined) ?? [];
          if (extra.length > 0) {
            projNodes = [...projNodes, ...extra];
          }
        } catch {
          // Network or schema errors should not break the overview; proceed with what we have.
        }
      }

      const active = projNodes
        .filter((p) => !p?.completedAt)
        .slice()
        .sort(sortActive);
      const done = projNodes
        .filter((p) => !!p?.completedAt)
        .slice()
        .sort(sortCompleted);
      const merged: ProjectNode[] = [];
      const seen = new Set<string>();
      for (const p of [...active, ...done]) {
        if (!p?.id || seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push(p);
        if (merged.length >= MAX_PROJECTS_PER_INITIATIVE) break;
      }
      const projViews = merged.map(projectViewFrom);
      return {
        name: i.name,
        ...(i.description !== undefined && i.description !== null
          ? { description: i.description }
          : {}),
        projects: projViews,
      } satisfies InitiativeView;
    }
  );

  // Labels: project (flat) and issue (global/byTeam)
  const projectLabelNodes = projectLbls.filter(isNotNullOrUndefined);
  const projectLabels: string[] = projectLabelNodes
    .map((l) => l.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const globals: string[] = [];
  const byTeamMap = new Map<
    string,
    { team: { name: string; key: string }; labels: string[] }
  >();
  const issueLabelNodes = (issueLbls ?? []).filter(isNotNullOrUndefined);
  for (const l of issueLabelNodes) {
    if (!l) continue;
    const labelName = l.name;
    if (!l.team) {
      globals.push(labelName);
    } else {
      const t = l.team;
      const key = t.id;
      const entry = byTeamMap.get(key) ?? {
        team: { name: t.name, key: t.key ?? t.name },
        labels: [] as string[],
      };
      entry.labels.push(labelName);
      byTeamMap.set(key, entry);
    }
  }
  globals.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const byTeam = Array.from(byTeamMap.values())
    .map((g) => ({
      team: g.team,
      labels: g.labels
        .slice()
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    }))
    .sort((a, b) =>
      a.team.name.localeCompare(b.team.name, undefined, { sensitivity: 'base' })
    );

  // Fallback: if no active initiatives, surface a concise list of active
  // projects (started/planned) for visibility. Per review: no need to
  // de‑duplicate across status categories.
  let activeProjects: ProjectView[] | undefined;
  if (initiativeViews.length === 0) {
    const LIMIT = 20 as const;
    const [started, planned] = await Promise.all([
      listProjects({ statusType: 'started', limit: LIMIT }, operationContext),
      listProjects({ statusType: 'planned', limit: LIMIT }, operationContext),
    ]);

    type ProjectListNode = NonNullable<
      NonNullable<GetProjectsQuery['projects']>['nodes'][number]
    >;

    const sortActiveList = (a: ProjectListNode, b: ProjectListNode): number => {
      const pa =
        typeof a.priority === 'number' ? a.priority : Number.POSITIVE_INFINITY;
      const pb =
        typeof b.priority === 'number' ? b.priority : Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return ub - ua;
    };

    const toProjectView = (p: ProjectListNode): ProjectView => {
      const leadName = p.lead?.displayName ?? p.lead?.name ?? null;
      return {
        name: p.name,
        status: p.status?.name ?? '',
        priority: typeof p.priority === 'number' ? p.priority : null,
        leadName,
        completedAt: p.completedAt ?? null,
        ...(p.description !== undefined && p.description !== null
          ? { description: p.description }
          : {}),
      } satisfies ProjectView;
    };

    const combined = [...started, ...planned]
      // Both filters target non-completed types, but keep a defensive filter.
      .filter((p): p is ProjectListNode => !!p && !p.completedAt)
      .sort(sortActiveList)
      .slice(0, LIMIT)
      .map(toProjectView);

    activeProjects = combined.length > 0 ? combined : undefined;
  }

  return {
    teams: teamViews,
    initiatives: initiativeViews,
    projectLabels,
    issueLabels: { global: globals, byTeam },
    ...(activeProjects ? { activeProjects } : {}),
  } satisfies WorkspaceOverview;
}
