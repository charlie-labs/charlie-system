import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  defineFlags,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
  zString,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  getTeamNames,
  type SentryProject,
} from '../../../lib/sentry-api.js';
import { formatDate } from '../../../lib/utils.js';
import { mapSentryError } from '../../utils/error-map.js';
import {
  createSentryDeps,
  requireSentryClient,
  type SentryDeps,
} from '../../utils/deps.js';
import { outputResult } from '../../utils/output.js';

const manifest = defineFlags({
  platform: {
    oclif: Flags.string({
      description: 'Filter projects by platform',
      helpGroup: 'Filter',
    }),
    schema: zString().optional(),
  },
  team: {
    oclif: Flags.string({
      description: 'Filter projects by team',
      helpGroup: 'Filter',
    }),
    schema: zString().optional(),
  },
  verbose: {
    oclif: Flags.boolean({
      char: 'v',
      description: 'Show detailed, multi-line output',
      default: false,
      helpGroup: 'Output',
    }),
    schema: z.boolean().optional(),
  },
});

export default class ProjectsList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ projects: SentryProject[] }>
> {
  static description = 'List all Sentry projects for the organization';

  static examples = [
    // TSV output (default)
    `<%= config.bin %> projects list
Name\tSlug\tPlatform\tCreated\tTeams
My Project\tmy-project\tjavascript\t2023-01-01\tteam-a, team-b`,

    // Filters
    `<%= config.bin %> projects list --platform=javascript
Name\tSlug\tPlatform\tCreated\tTeams
My Project\tmy-project\tjavascript\t2023-01-01\tteam-a`,

    // Verbose human view
    `<%= config.bin %> projects list --verbose
- My Project (my-project)
  Platform: javascript
  Created: 2023-01-01
  Teams: team-a, team-b`,

    // JSON output
    `<%= config.bin %> projects list --json`,
  ];

  static override flags = super.registerManifest(manifest);

  static override buildDeps(
    _parsed: ParsedOf<typeof manifest>
  ): SentryDeps {
    return createSentryDeps();
  }

  // Use shared date utilities; no in-class formatter to keep output consistent.
  // Check if a project has a team matching the filter
  matchesTeam(project: SentryProject, teamFilter: string): boolean {
    const teamNames = getTeamNames(project);
    return teamNames.some(
      (name) => name.toLowerCase() === teamFilter.toLowerCase()
    );
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ projects: SentryProject[] }> {
    try {
      const client = requireSentryClient(deps);
      let projects = await client.getProjects();

      const { platform, team, verbose } = parsed;

      // Apply filters
      if (platform) {
        projects = projects.filter(
          (project) =>
            project.platform?.toLowerCase() === platform.toLowerCase()
        );
      }

      if (team) {
        projects = projects.filter((project) =>
          this.matchesTeam(project, team)
        );
      }

      if (projects.length === 0) {
        this.logInfo('No projects found.');
      } else if (verbose) {
        // Preserve the existing verbose view with multi-line details
        projects.forEach((project: SentryProject) => {
          this.logInfo(
            `- ${project.name || 'Unnamed Project'} (${project.slug || 'no-slug'})`
          );
          if (project.platform) {
            this.logInfo(`  Platform: ${project.platform}`);
          }
          if (project.dateCreated) {
            this.logInfo(`  Created: ${formatDate(project.dateCreated)}`);
          }
          const teamNames = getTeamNames(project);
          if (teamNames.length > 0) {
            this.logInfo(`  Teams: ${teamNames.join(', ')}`);
          }
          this.logInfo('');
        });
      } else {
        // TSV output with headers for consistent human formatting
        const header = ['Name', 'Slug', 'Platform', 'Created', 'Teams'];
        const rows = projects.map((p) => [
          p.name || '',
          p.slug || '',
          p.platform || '',
          formatDate(p.dateCreated),
          getTeamNames(p).join(', '),
        ]);
        this.printRows(rows, { header });
      }

      // Return the projects for JSON output
      return outputResult(this, { projects });
    } catch (error) {
      // Normalize exit codes via plugin error classes
      throw mapSentryError(error);
    }
  }
}
