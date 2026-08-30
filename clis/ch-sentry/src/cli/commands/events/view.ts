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

import { formatDateTime } from '../../../lib/utils.js';
import { type SentryEvent } from '../../../lib/sentry-api.js';
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
});

export default class EventView extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ event: SentryEvent }>
> {
  static description = 'View details of a specific event for a Sentry issue';

  static examples = [
    `<%= config.bin %> events view PROJ-123 abc123 -o my-org
Event Details:
  ID: abc123def456
  Title: Error in function X
  Date: 2023-04-01 12:34:56
  Platform: javascript
  ...`,

    `<%= config.bin %> events view PROJ-123 latest -o my-org
Event Details (latest):
  ID: abc123def456
  Title: Error in function X
  Date: 2023-04-01 12:34:56
  Platform: javascript
  ...`,

    `<%= config.bin %> events view PROJ-123 oldest
Event Details (oldest):
  ID: abc123def456
  Title: Error in function X
  Date: 2023-01-15 10:22:33
  Platform: javascript
  ...`,

    `<%= config.bin %> events view PROJ-123 abc123 --json
{
  "event": {
    "id": "abc123",
    "eventID": "abc123def456",
    "dateCreated": "2023-04-01T12:34:56Z",
    ...
  }
}`,
  ];

  static args = {
    issueId: Args.string({
      name: 'issueId',
      description: 'The ID of the issue (e.g., PROJ-123)',
      required: true,
    }),
    eventId: Args.string({
      name: 'eventId',
      description:
        'The ID of the event to view, or one of: latest, oldest, recommended',
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
  }: ExecCtxOf<this>): Promise<{ event: SentryEvent }> {
    const { args } = await this.parse(EventView);

    try {
      const client = requireSentryClient(deps);

      // Get the specific event for the issue
      const event = await client.getIssueEvent(args.issueId, args.eventId);

      // Format and display the event if not using JSON output
      if (!this.jsonEnabled?.()) {
        const specialId = ['latest', 'oldest', 'recommended'].includes(
          args.eventId
        )
          ? ` (${args.eventId})`
          : '';
        this.logInfo(`Event Details${specialId}:`);

        const dateTime = formatDateTime(event.dateCreated);

        this.logInfo(`  ID: ${event.eventID}`);
        this.logInfo(`  Title: ${event.title || event.message || 'No title'}`);
        this.logInfo(`  Date: ${dateTime}`);

        if (event.platform) {
          this.logInfo(`  Platform: ${event.platform}`);
        }

        if (event.user) {
          this.logInfo('  User:');
          if (event.user.id) this.logInfo(`    ID: ${event.user.id}`);
          if (event.user.username) {
            this.logInfo(`    Username: ${event.user.username}`);
          }
          if (event.user.email) this.logInfo(`    Email: ${event.user.email}`);
        }

        if (event.tags && event.tags.length > 0) {
          this.logInfo('  Tags:');
          event.tags.forEach((tag) => {
            this.logInfo(`    ${tag.key}: ${tag.value}`);
          });
        }
      }

      // Return event for JSON output
      return outputResult(this, { event });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
