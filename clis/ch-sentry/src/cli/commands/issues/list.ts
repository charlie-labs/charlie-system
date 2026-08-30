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
import { z } from 'zod3';

import { type IssueWithLinear } from '../../../lib/types.js';
import { formatDate, getLinearAnnotationUrl } from '../../../lib/utils.js';
import { mapSentryError } from '../../utils/error-map.js';
import {
  createSentryDeps,
  requireSentryClient,
  type SentryDeps,
} from '../../utils/deps.js';
import { outputResult } from '../../utils/output.js';

const ISSUE_SORT_VALUES = [
  'frequency',
  'new',
  'lastSeen',
  'firstSeen',
] as const;

const SENTRY_SORT_BY_CLI_SORT: Record<
  (typeof ISSUE_SORT_VALUES)[number],
  'freq' | 'new' | 'date'
> = {
  frequency: 'freq',
  new: 'new',
  lastSeen: 'date',
  firstSeen: 'new',
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
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'Project slug',
      required: true,
      helpGroup: 'Selection',
    }),
    schema: zString(),
  },
  // Filters
  file: {
    oclif: Flags.string({
      char: 'f',
      description: 'Filter issues by file name',
      helpGroup: 'Filter',
    }),
    schema: zString().optional(),
  },
  error: {
    oclif: Flags.string({
      char: 'e',
      description: 'Filter issues by error message (legacy - prefer --query)',
      helpGroup: 'Filter',
    }),
    schema: zString().optional(),
  },
  query: {
    oclif: Flags.string({
      char: 'Q', // avoid -q which can collide with global --quiet
      description: 'Raw search query (overrides legacy --error)',
      helpGroup: 'Filter',
    }),
    schema: zString().optional(),
  },
  tag: {
    oclif: Flags.string({
      char: 't',
      description:
        'Filter by tag in key=value format; repeat -t for multiple (e.g., -t env=prod -t user.id=123). Comma-separated values are not supported.',
      multiple: true,
      helpGroup: 'Filter',
    }),
    // Enforce key=value at parse time; preserve repeatable inputs (no comma splitting)
    schema: z
      .array(
        z.string().regex(/^([^=]+)=([^=]+)$/i, 'Expected key=value format')
      )
      .optional(),
  },
  // Pagination / sorting
  limit: {
    oclif: Flags.integer({
      char: 'L',
      description: 'Maximum number of items to return (10000 max)',
      default: 20,
      helpGroup: 'Output',
    }),
    schema: zPositiveInt({ default: 20, max: 10_000 }),
  },
  sort: {
    oclif: Flags.option({
      options: ISSUE_SORT_VALUES,
      description: 'Sort by attribute',
      default: 'lastSeen',
      helpGroup: 'Output',
    })(),
    schema: z.enum(ISSUE_SORT_VALUES).default('lastSeen'),
  },
  // Time window
  since: {
    oclif: Flags.string({
      description: 'Filter start (ISO8601 or relative, forwarded as start)',
      helpGroup: 'Time window',
    }),
    schema: zString().optional(),
  },
  until: {
    oclif: Flags.string({
      description: 'Filter end (ISO8601 or relative, forwarded as end)',
      helpGroup: 'Time window',
    }),
    schema: zString().optional(),
  },
});

export default class IssuesList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ issues: IssueWithLinear[] }>
> {
  static description = 'List and search Sentry issues for a project';

  static examples = [
    // TSV output (default)
    `<%= config.bin %> issues list -o my-org -p my-project -L 5 --sort lastSeen
ID\tFirst Seen\tLast Seen\tType\tStatus\tCount\tCulprit\tTitle
PROJ-123\t2023-03-01\t2023-04-01\terror\tunresolved\t42\tapi.call\tError in function X`,

    // Filtered by tag
    `<%= config.bin %> issues list -o my-org -p my-project -t environment=production
ID\tFirst Seen\tLast Seen\tType\tStatus\tCount\tCulprit\tTitle
PROJ-123\t2023-03-01\t2023-04-01\terror\tunresolved\t42\tapi.call\tError in function X`,

    // JSON output
    `<%= config.bin %> issues list -o my-org -p my-project --json`,
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
  }: ExecCtxOf<this>): Promise<{ issues: IssueWithLinear[] }> {
    try {
      const client = requireSentryClient(deps);

      // Build query parameters from CLI flags
      const query: Record<string, string> = {};

      if (parsed.file) query['file'] = parsed.file;

      // Prefer the new --query flag over the legacy --error flag
      if (parsed.query) {
        query['query'] = parsed.query;
      } else if (parsed.error) {
        query['query'] = parsed.error;
      }

      if (parsed.since) query['start'] = parsed.since;
      if (parsed.until) query['end'] = parsed.until;

      // Translate stable CLI aliases to the values supported by Sentry.
      query['sort'] = SENTRY_SORT_BY_CLI_SORT[parsed.sort];

      // Add tag filters (schema guarantees key=value format)
      if (parsed.tag?.length) {
        parsed.tag.forEach((pair, index) => {
          const [key, value] = pair.split('=');
          query[`tag[${index}]`] = `${key}:${value}`;
        });
      }

      // Fetch issues
      const allIssues = await client.getIssues(parsed.project, query);

      // Client-side limit enforcement (Sentry API does not support a limit param)
      const issues = allIssues.slice(0, parsed.limit);

      // Human-readable TSV output with headers (no prose preface)
      if (!this.jsonEnabled?.()) {
        if (issues.length === 0) {
          this.logInfo('No issues found.');
        } else {
          const header = [
            'ID',
            'First Seen',
            'Last Seen',
            'Type',
            'Status',
            'Count',
            'Culprit',
            'Title',
          ];
          const rows = issues.map((issue) => [
            issue.shortId,
            formatDate(issue.firstSeen),
            formatDate(issue.lastSeen),
            issue.type,
            issue.status,
            String(issue.count),
            issue.culprit,
            issue.title,
          ]);
          this.printRows(rows, { header });
        }
      }

      // Return issues for JSON output, including a convenience `linearUrl` field when present
      const withLinear: IssueWithLinear[] = issues.map((issue) => {
        const linearUrl = getLinearAnnotationUrl(issue.annotations);
        return linearUrl ? { ...issue, linearUrl } : issue;
      });
      return outputResult(this, { issues: withLinear });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
