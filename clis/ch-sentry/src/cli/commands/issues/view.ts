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
import { Args, Flags } from '@oclif/core';

import { type IssueWithLinear } from '../../../lib/types.js';
import { formatDate, getLinearAnnotationUrl } from '../../../lib/utils.js';
import { mapSentryError } from '../../utils/error-map.js';
import {
  createSentryDeps,
  requireSentryClient,
  type SentryDeps,
} from '../../utils/deps.js';
import { outputResult } from '../../utils/output.js';

const manifest = defineFlags({
  organization: {
    oclif: Flags.string({
      char: 'o',
      description: 'Organization slug (defaults to SENTRY_ORG when omitted)',
      helpGroup: 'Selection',
    }),
    schema: zString().optional(),
  },
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'Project slug',
      required: true,
      helpGroup: 'Selection',
    }),
    schema: zString(),
  },
});

export default class IssuesView extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ issue: IssueWithLinear }>
> {
  static description = 'View detailed information for a specific Sentry issue';

  static examples = [
    `<%= config.bin %> issues view PROJ-123 -o my-org -p my-project
Issue PROJ-123:
Title: Error in function X
Status: unresolved
Level: error
First seen: 2023-03-01
Last seen: 2023-04-01
Events: 42
Users affected: 12`,

    `<%= config.bin %> issues view PROJ-123 -p my-project
Issue PROJ-123:
Title: Error in function X
Status: unresolved
Level: error
First seen: 2023-03-01
Last seen: 2023-04-01
Events: 42
Users affected: 12`,

    `<%= config.bin %> issues view PROJ-123 -o my-org -p my-project --json
{
  "issue": {
    "id": "12345",
    "shortId": "PROJ-123",
    "title": "Error in function X",
    "status": "unresolved",
    ...
  }
}`,
  ];

  static args = {
    issueId: Args.string({
      name: 'issueId',
      description: 'The ID of the issue to view (e.g., PROJ-123)',
      required: true,
    }),
  };

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
  }: ExecCtxOf<this>): Promise<{ issue: IssueWithLinear }> {
    const { args } = await this.parse(IssuesView);

    try {
      const client = requireSentryClient(deps);

      // Get the issue details with the updated method signature
      const issue = await client.getIssue(parsed.project, args.issueId);

      // Format and display issue details if not using JSON output
      if (!this.jsonEnabled?.()) {
        this.logInfo(`Issue ${issue.shortId}:`);
        this.logInfo(`Title: ${issue.title}`);
        this.logInfo(`Status: ${issue.status}`);
        this.logInfo(`Level: ${issue.level}`);
        this.logInfo(`First seen: ${formatDate(issue.firstSeen)}`);
        this.logInfo(`Last seen: ${formatDate(issue.lastSeen)}`);
        this.logInfo(`Events: ${issue.count}`);
        this.logInfo(`Users affected: ${issue.userCount}`);

        // Display project info
        if (issue.project) {
          this.logInfo(
            `Project: ${issue.project.name} (${issue.project.slug})`
          );
        }

        // Display culprit if available
        if (issue.culprit) {
          this.logInfo(`Culprit: ${issue.culprit}`);
        }

        // Check if there's a meta section for type specific information
        if (issue.metadata && Object.keys(issue.metadata).length > 0) {
          this.logInfo('\nMetadata:');
          for (const [key, value] of Object.entries(issue.metadata)) {
            this.logInfo(`  ${key}: ${JSON.stringify(value)}`);
          }
        }
      }

      // Return the issue for JSON output, adding `linearUrl` when present
      const linearUrl = getLinearAnnotationUrl(issue.annotations);
      return outputResult(this, {
        issue: linearUrl ? { ...issue, linearUrl } : issue,
      });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
