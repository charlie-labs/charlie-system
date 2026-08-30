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
  limit: {
    oclif: Flags.integer({
      char: 'L',
      description: 'Maximum number of items to return (10000 max)',
      default: 10,
      helpGroup: 'Output',
    }),
    schema: zPositiveInt({ default: 10, max: 10_000 }),
  },
});

export default class EventList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ events: SentryEvent[] }>
> {
  static description = 'List recent events for a specific Sentry issue';

  static examples = [
    `<%= config.bin %> events list PROJ-123 -o my-org
EventID\tCreated\tTitle
abc123def456\t4/1/2023 12:34:56 PM\tError in function X`,

    `<%= config.bin %> events list PROJ-123 -L 5
EventID\tCreated\tTitle
abc123def456\t4/1/2023 12:34:56 PM\tError in function X`,

    `<%= config.bin %> events list PROJ-123 --json
{
  "events": [
    {
      "id": "abc123",
      "eventID": "abc123def456",
      "dateCreated": "2023-04-01T12:34:56Z"
    }
  ]
}`,
  ];

  static args = {
    issueId: Args.string({
      name: 'issueId',
      description: 'The ID of the issue to fetch events for (e.g., PROJ-123)',
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
  }: ExecCtxOf<this>): Promise<{ events: SentryEvent[] }> {
    const { args } = await this.parse(EventList);

    try {
      const client = requireSentryClient(deps);

      // Build query parameters - do not include limit as API doesn't support it
      const query: Record<string, string | number> = {};

      // Get events for the issue with the correct parameter order
      const allEvents = await client.getIssueEvents(args.issueId, query);

      // Apply the limit (Sentry doesn't support a limit param so we do it here)
      const events = allEvents.slice(0, parsed.limit);

      // Format and display events in TSV if not using JSON output
      if (!this.jsonEnabled?.()) {
        if (events.length === 0) {
          this.logInfo('No events found.');
        } else {
          const header = ['EventID', 'Created', 'Title'];
          const rows = events.map((e) => [
            e.eventID,
            formatDateTime(e.dateCreated),
            e.title || e.message || 'No title',
          ]);
          this.printRows(rows, { header });
        }
      }

      // Return events for JSON output
      return outputResult(this, { events });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
