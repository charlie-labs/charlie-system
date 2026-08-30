import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';

import { type Sdk } from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import {
  getWorkspaceOverview,
  type WorkspaceOverview,
} from '../../../lib/operations/workspace/get-workspace-overview.js';

export default class WorkspaceOverviewCmd extends BaseCommand<
  | Deps<
      LinearDeps<
        | 'GetTeams'
        | 'GetInitiatives'
        | 'GetWorkflowStates'
        | 'GetIssueLabels'
        | 'GetProjectLabels'
        | 'GetInitiativeProjects'
        | 'GetProjects'
      >
    >
  | Result<WorkspaceOverview>
> {
  static description = [
    'Get a high-level overview of the Linear workspace.',
    '',
    'JSON schema (abbreviated, self-contained):',
    '```ts',
    'type ProjectView = {',
    '  name: string;',
    '  status: string;',
    '  priority: number | null;',
    '  leadName: string | null;',
    '  completedAt: ISODate | null;',
    '  description?: string;',
    '};',
    '',
    'type WorkspaceOverview = {',
    '  teams: { name: string; key: string; issueStatuses: string[] }[];',
    '  initiatives: { name: string; description?: string; projects: ProjectView[] }[];',
    '  projectLabels: string[];',
    '  issueLabels: {',
    '    global: string[];',
    '    byTeam: { team: { name: string; key: string }; labels: string[] }[];',
    '  };',
    '  activeProjects?: ProjectView[];',
    '};',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  protected async execute(ctx: ExecCtxOf<this>): Promise<WorkspaceOverview> {
    const { client, cache } = resolveDeps<
      Pick<
        Sdk,
        | 'GetTeams'
        | 'GetInitiatives'
        | 'GetWorkflowStates'
        | 'GetIssueLabels'
        | 'GetProjectLabels'
        | 'GetInitiativeProjects'
        | 'GetProjects'
      >
    >(ctx.deps, getLinearSdk);

    const overview = await getWorkspaceOverview({ client, cache });

    if (!this.jsonEnabled()) {
      // Human-readable output (stdout only) matching the requested template
      //
      // Teams:
      // - <team_key>: <team_name>
      this.log('Teams:');
      for (const t of overview.teams) {
        this.log(`- ${t.key}: ${t.name}`);
      }

      this.log('');
      // When there are active initiatives, render them. Otherwise, render the
      // operation-provided activeProjects fallback (if present).

      if (overview.initiatives.length > 0) {
        // Active Initiatives:
        // <initiative_name>: <initiative_description>
        // - [<project_status>|p<project_priority>] <project_name>: <project_description>
        this.log('Active Initiatives:');
        for (const [idx, i] of overview.initiatives.entries()) {
          if (i.description) {
            this.log(`${i.name}: ${i.description}`);
          } else {
            this.log(i.name);
          }
          for (const p of i.projects) {
            const prio = p.priority == null ? '' : `|p${p.priority}`;
            const pdesc = p.description ? `: ${p.description}` : '';
            this.log(`- [${p.status}${prio}] ${p.name}${pdesc}`);
          }
          // Blank line between initiatives (not after the last item)
          if (
            idx < overview.initiatives.length - 1 &&
            (i.projects.length > 0 || i.description)
          ) {
            this.log('');
          }
        }
      } else if (
        overview.activeProjects &&
        overview.activeProjects.length > 0
      ) {
        this.log('Active Projects:');
        for (const p of overview.activeProjects) {
          const prio = p.priority == null ? '' : `|p${p.priority}`;
          const pdesc = p.description ? `: ${p.description}` : '';
          this.log(`- [${p.status}${prio}] ${p.name}${pdesc}`);
        }
      }

      // Project labels: <names_comma_separated>
      const projectLabelsLine = overview.projectLabels.join(', ');
      this.log(`Project labels: ${projectLabelsLine}`);

      // Issue labels:
      // - Global: <names_comma_separated>
      // - <team_name>: <names_comma_separated>
      this.log('Issue labels:');
      const globalLine = overview.issueLabels.global.join(', ');
      this.log(`- Global: ${globalLine}`);
      for (const g of overview.issueLabels.byTeam) {
        const names = g.labels.join(', ');
        this.log(`- ${g.team.name}: ${names}`);
      }
    }

    return overview;
  }
}
