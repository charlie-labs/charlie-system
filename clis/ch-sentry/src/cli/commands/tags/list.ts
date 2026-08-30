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

import { type SentryTag } from '../../../lib/sentry-api.js';
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
});

export default class TagsList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<SentryDeps>
  | Result<{ tags: SentryTag[] }>
> {
  static description = 'List tags available for a project';

  static examples = [
    // TSV output (default)
    `<%= config.bin %> tags list -p my-project
Key\tUnique Values\tName
browser\t10\tBrowser
os\t5\tOS
environment\t3\tEnvironment`,

    // JSON output
    `<%= config.bin %> tags list -p my-project --json`,
  ];

  static override flags = super.registerManifest(manifest);

  static override buildDeps(
    _parsed: ParsedOf<typeof manifest>
  ): SentryDeps {
    return createSentryDeps();
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ tags: SentryTag[] }> {
    try {
      const client = requireSentryClient(deps);

      // Use the new getTags method instead of generic request
      const tags = await client.getTags(parsed.project);

      // Format and display tags in TSV if not using JSON output
      if (!this.jsonEnabled?.()) {
        if (!Array.isArray(tags) || tags.length === 0) {
          this.logInfo('No tags found.');
        } else {
          const header = ['Key', 'Unique Values', 'Name'];
          const rows = tags.map((t) => [
            t.key,
            String(t.uniqueValues),
            t.name || '',
          ]);
          this.printRows(rows, { header });
        }
      }

      // Return tags for JSON output
      return outputResult(this, { tags });
    } catch (error) {
      throw mapSentryError(error);
    }
  }
}
