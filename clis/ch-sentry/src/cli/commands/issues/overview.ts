import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  defineFlags,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
  zPositiveInt,
  zString,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';

import { type SentryIssue } from '../../../lib/sentry-api.js';
import { type IssueAnnotation } from '../../../lib/types.js';
import {
  formatDate,
  getLinearAnnotationUrl,
  resolveRelativeOrIso,
} from '../../../lib/utils.js';
import { mapSentryError } from '../../utils/error-map.js';
import {
  createSentryDeps,
  requireSentryClient,
  type SentryDeps,
} from '../../utils/deps.js';
import { outputResult } from '../../utils/output.js';

type OverviewIssue = {
  id: string; // shortId (e.g., PROJ-123)
  title: string;
  /**
   * Total event count reported by the issues endpoint for this issue.
   * Note: This is not window-scoped; it reflects the server-provided aggregate.
   */
  events: number;
  url: string;
  /** First Linear annotation URL when present. */
  linearUrl?: string;
  // Pass through any annotations returned by Sentry (e.g., Linear links)
  annotations?: IssueAnnotation[];
};

type ProjectOverview = {
  project: string; // slug
  activeIssues: number;
  events: number;
  newUnresolved: number;
  unassignedWithEvents: number;
  topIssues: OverviewIssue[];
};

const manifest = defineFlags({
  organization: {
    oclif: Flags.string({
      char: 'o',
      description: 'Organization slug (defaults to SENTRY_ORG when omitted)',
      helpGroup: 'Selection',
    }),
    schema: zString().optional(),
  },
  // Time window
  since: {
    oclif: Flags.string({
      description:
        'Filter start (ISO8601 or relative, forwarded as start). Defaults to 24h ago when omitted.',
      helpGroup: 'Time window',
    }),
    schema: zString().optional(),
  },
  until: {
    oclif: Flags.string({
      description:
        'Filter end (ISO8601 or relative, forwarded as end). Defaults to now when omitted.',
      helpGroup: 'Time window',
    }),
    schema: zString().optional(),
  },
  top: {
    oclif: Flags.integer({
      char: 'n',
      description:
        // Note: Ranking is based on lifetime event count among issues active in the window.
        // We don't currently re-aggregate counts scoped strictly to the window.
        'Number of top issues (by lifetime event count among issues active in the window) to list per project',
      default: 5,
      helpGroup: 'Output',
    }),
    schema: zPositiveInt({ default: 5, max: 100 }),
  },
});

export default class IssuesOverview extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ overview: ProjectOverview[] }>
> {
  static description =
    'Generate an overview of Sentry issues across projects for a time window.';

  static examples = [
    // Default 24h window
    `<%= config.bin %> issues overview`,
    // Explicit window + JSON
    `<%= config.bin %> issues overview --since 2025-10-15T00:00:00Z --until 2025-10-16T00:00:00Z --json`,
  ];

  static override flags = super.registerManifest(manifest);

  static override buildDeps(
    parsed: ParsedOf<typeof manifest>
  ): SentryDeps {
    return createSentryDeps(
      parsed.organization ? { organization: parsed.organization } : undefined
    );
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ overview: ProjectOverview[] }> {
    try {
      const client = requireSentryClient(deps);

      // Resolve window defaults: last 24h when omitted.
      // For local comparisons we need absolute Dates even when flags are relative (e.g., '24h').
      const resolvedUntil = parsed.until
        ? resolveRelativeOrIso(parsed.until)
        : undefined;
      if (parsed.until && !resolvedUntil) {
        this.error(
          `Invalid --until value: ${parsed.until}. Use ISO8601 (e.g., 2025-10-16T00:00:00Z) or a relative duration (e.g., 24h, 7d).`
        );
      }
      const endDate = resolvedUntil ?? new Date();

      // Resolve --since relative to the resolved end when using relative durations
      const resolvedSince = parsed.since
        ? resolveRelativeOrIso(parsed.since, endDate)
        : undefined;
      if (parsed.since && !resolvedSince) {
        this.error(
          `Invalid --since value: ${parsed.since}. Use ISO8601 or a relative duration (e.g., 24h, 7d).`
        );
      }
      const startDate =
        resolvedSince ?? new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      if (startDate > endDate) {
        this.error(
          `Start must be before end (got start=${formatDate(startDate.toISOString())} > end=${formatDate(endDate.toISOString())}).`
        );
      }

      // Always forward absolute ISO timestamps to the API (avoid passing raw relative strings)
      const endIso = endDate.toISOString();
      const startIso = startDate.toISOString();

      // Fetch projects in org
      const projects = await client.getProjects();

      // Build the overview concurrently with a modest concurrency limit
      const concurrency = 4;
      const overview: ProjectOverview[] = [];
      const projectChunks: (typeof projects)[] = [];
      for (let i = 0; i < projects.length; i += concurrency) {
        projectChunks.push(projects.slice(i, i + concurrency));
      }

      for (const chunk of projectChunks) {
        const results = await Promise.all(
          chunk.map(async (project) => {
            try {
              // Prefer first-class start/end params; avoid duplicating lastSeen in query text
              const requested = parsed.top * 3;
              const perPage = String(Math.min(100, Math.max(requested, 50)));
              const query: Record<string, string> = {
                start: startIso,
                end: endIso,
                sort: 'date',
                per_page: perPage,
              };

              const issues = await client.getIssues(project.slug, query);

              // Compute metrics
              const activeIssues = issues.length;
              const eventsTotal = issues.reduce(
                (acc, issue) => acc + Number(issue.count ?? 0),
                0
              );
              const newUnresolved = issues.filter((i) => {
                const first = new Date(i.firstSeen);
                const inWindow = first >= startDate && first <= endDate;
                return inWindow && i.status === 'unresolved';
              }).length;
              const unassignedWithEvents = issues.filter(
                (i) => !i.assignedTo && Number(i.count ?? 0) > 0
              ).length;

              // Top issues in this project by event count; filter zeros for clearer output
              const topIssues: OverviewIssue[] = issues
                .map<OverviewIssue>((i) => {
                  const linearUrl = getLinearAnnotationUrl(i.annotations);
                  return {
                    id: i.shortId,
                    title: i.title,
                    events: Number(i.count ?? 0),
                    url: buildIssueUrl(
                      client.getBaseUrl(),
                      client.getOrganizationSlug(),
                      i
                    ),
                    ...(linearUrl ? { linearUrl } : {}),
                    ...(i.annotations?.length
                      ? { annotations: i.annotations }
                      : {}),
                  };
                })
                .filter((i) => i.events > 0)
                .sort((a, b) => b.events - a.events)
                .slice(0, parsed.top);

              return {
                project: project.slug,
                activeIssues,
                events: eventsTotal,
                newUnresolved,
                unassignedWithEvents,
                topIssues,
              } satisfies ProjectOverview;
            } catch (e) {
              this.warn(
                `Failed to fetch issues for ${project.slug}: ${stringifyError(e)}`
              );
              return {
                project: project.slug,
                activeIssues: 0,
                events: 0,
                newUnresolved: 0,
                unassignedWithEvents: 0,
                topIssues: [],
              } satisfies ProjectOverview;
            }
          })
        );

        overview.push(...results);
      }

      // Human TSV output matching the requested columns
      if (!this.jsonEnabled?.()) {
        const header = [
          'Project',
          'Active issues',
          'Events',
          'New unresolved',
          'Unassigned with events',
        ];
        const rows = overview.map((p) => [
          p.project,
          String(p.activeIssues),
          String(p.events),
          String(p.newUnresolved),
          String(p.unassignedWithEvents),
        ]);
        this.printRows(rows, { header });

        // Then print the per-project top issue lists
        for (const p of overview) {
          this.log('');
          const shown = p.topIssues.length;
          this.logInfo(`Top ${shown} issues for ${p.project}`);
          if (!p.topIssues.length) {
            this.log('No issues with events for this project.');
            continue;
          }
          const topHeader = ['Title', 'ID', 'Events', 'Link', 'Linear'];
          const topRows = p.topIssues.map((i) => [
            i.title,
            i.id,
            String(i.events),
            i.url,
            i.linearUrl ?? '',
          ]);
          this.printRows(topRows, { header: topHeader });
        }
      }

      return outputResult(this, { overview });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}

function buildIssueUrl(
  baseApiUrl: string,
  org: string,
  issue: SentryIssue
): string {
  // Convert API base (e.g., https://sentry.io/api/0) to app origin
  // Works for regional bases like https://eu.sentry.io/api/0
  const api = new URL(baseApiUrl);
  const origin = `${api.protocol}//${api.host}`;
  // Sentry issue URLs use the numeric issue id with a project query param
  return `${origin}/organizations/${org}/issues/${issue.id}/?project=${issue.project.id}`;
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
