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

import {
  type SentryTagValue,
} from '../../../lib/sentry-api.js';
import { formatDateTime } from '../../../lib/utils.js';
import { mapSentryError } from '../../utils/error-map.js';
import {
  createSentryDeps,
  requireSentryClient,
  type SentryDeps,
} from '../../utils/deps.js';
import { outputResult } from '../../utils/output.js';

const manifest = defineFlags({
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'Project slug',
      required: true,
      helpGroup: 'Selection',
    }),
    schema: zString(),
  },
  limit: {
    oclif: Flags.integer({
      char: 'L',
      description: 'Maximum number of items to return (10000 max)',
      default: 20,
      helpGroup: 'Output',
    }),
    schema: zPositiveInt({ default: 20, max: 10_000 }),
  },
  query: {
    oclif: Flags.string({
      char: 'Q', // avoid -q which oclif reserves for --quiet
      description: 'Filter tag values (contains)',
      helpGroup: 'Filter',
    }),
    schema: zString().optional(),
  },
});

export default class TagsValues extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ values: SentryTagValue[] }>
> {
  static description = 'List distinct values for a specific tag key';

  static examples = [
    // TSV output (default)
    `<%= config.bin %> tags values browser -p my-project
Name\tCount\tFirst Seen\tLast Seen
Chrome\t100\t2023-04-01 12:34\t2023-04-12 09:01`,

    // Filtered TSV output
    `<%= config.bin %> tags values browser -p my-project -Q chr
Name\tCount\tFirst Seen\tLast Seen
Chrome\t100\t2023-04-01 12:34\t2023-04-12 09:01`,

    // JSON output
    `<%= config.bin %> tags values browser -p my-project --json`,
  ];

  static args = {
    'tag-key': Args.string({
      description: 'The tag key to list values for',
      required: true,
    }),
  };

  static override flags = super.registerManifest(manifest);

  static override buildDeps(
    _parsed: ParsedOf<typeof manifest>
  ): SentryDeps {
    return createSentryDeps();
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ values: SentryTagValue[] }> {
    const { args } = await this.parse(TagsValues);
    const tagKey = args['tag-key'];

    try {
      const client = requireSentryClient(deps);

      // Use the updated getTagValues method with options object
      const options = parsed.query
        ? { limit: parsed.limit, query: parsed.query }
        : { limit: parsed.limit };
      const values = await client.getTagValues(parsed.project, tagKey, options);

      // Format and display tag values in TSV if not using JSON output
      if (!this.jsonEnabled?.()) {
        if (!Array.isArray(values) || values.length === 0) {
          this.logInfo('No values found for this tag.');
        } else {
          const header = ['Name', 'Count', 'First Seen', 'Last Seen'];
          const rows = values.map((v) => [
            v.name,
            v.count !== undefined ? String(v.count) : '',
            v.firstSeen ? formatDateTime(v.firstSeen) : '',
            v.lastSeen ? formatDateTime(v.lastSeen) : '',
          ]);
          this.printRows(rows, { header });
        }
      }

      // Return tag values for JSON output
      return outputResult(this, { values });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
