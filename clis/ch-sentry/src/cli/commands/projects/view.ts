import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

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

export default class ProjectsView extends BaseCommand<
  Deps<SentryDeps> | Result<{ project: SentryProject }>
> {
  static description = 'Display details for a specific Sentry project';

  static examples = [
    `<%= config.bin %> projects view my-project
Name: My Project
Slug: my-project
Platform: javascript
Status: active
Created: 2023-01-01
Teams: team-a, team-b
Features: releases, event-attachments, performance-view
`,
    `<%= config.bin %> projects view my-project --json
{
  "project": {
    "id": "123456",
    "slug": "my-project",
    "name": "My Project",
    ...
  }
}`,
  ];

  static args = {
    slug: Args.string({
      description: 'The slug of the project to view',
      required: true,
    }),
  };

  static override buildDeps(): SentryDeps {
    return createSentryDeps();
  }

  protected override async execute(
    { deps }: ExecCtxOf<this>
  ): Promise<{ project: SentryProject }> {
    const { args } = await this.parse(ProjectsView);

    try {
      const client = requireSentryClient(deps);
      const project = await client.getProject(args.slug);

      // Format and display project details if not using JSON output
      if (!this.jsonEnabled?.()) {
        this.logInfo(`Name: ${project.name || 'N/A'}`);
        this.logInfo(`Slug: ${project.slug || 'N/A'}`);
        this.logInfo(`Platform: ${project.platform || 'N/A'}`);
        this.logInfo(`Status: ${project.status || 'N/A'}`);
        this.logInfo(`Created: ${formatDate(project.dateCreated)}`);

        // Display teams if available
        const teamNames = getTeamNames(project);
        if (teamNames.length > 0) {
          this.logInfo(`Teams: ${teamNames.join(', ')}`);
        } else {
          this.logInfo('Teams: None');
        }

        // Display features if available
        if (
          project.features &&
          Array.isArray(project.features) &&
          project.features.length > 0
        ) {
          this.logInfo(`Features: ${project.features.join(', ')}`);
        } else {
          this.logInfo('Features: None');
        }

        // Display organization info
        if (project.organization) {
          this.logInfo(
            `Organization: ${project.organization.name} (${project.organization.slug})`
          );
        }
      }

      // Return the project for JSON output
      return outputResult(this, { project });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
