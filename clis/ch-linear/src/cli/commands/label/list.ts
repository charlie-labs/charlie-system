import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
  zPositiveInt,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';

import {
  type GetIssueLabelsQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listLabels } from '../../../lib/operations/label/list-labels.js';

type LabelNodes = GetIssueLabelsQuery['issueLabels']['nodes'];

/**
 * List issue labels in the workspace.
 *
 * Labels are fetched in pages (50 per request) until either the requested
 * limit is reached or no more labels are available. Each label is printed on
 * its own line in TSV with four columns:
 *
 *   <label id>\t<label name>\t<team name>\t<color>
 *
 * Example usage:
 *   $ <%= config.bin %> <%= command.id %>            # lists up to 50 labels (default)
 *   $ <%= config.bin %> <%= command.id %> --limit 10 # lists up to 10 labels
 */
const DEFAULT_LIMIT = 50;

const manifest = defineFlags({
  limit: {
    oclif: Flags.integer({
      char: 'l',
      description: 'Maximum number of labels to list (default 50)',
      default: DEFAULT_LIMIT,
      min: 1,
    }),
    schema: zPositiveInt({ default: DEFAULT_LIMIT }),
  },
} as const);

export default class LabelList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetIssueLabels'>>
  | Result<LabelNodes>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'List issue labels in the workspace.',
    '',
    'Output',
    '- TSV columns (in order): id, name, team, color',
    '- JSON shape:',
    '```ts',
    'type Label = {',
    '  id: uuid;',
    '  name: string;',
    '  description: string | null;',
    '  color: string | null;',
    '  team: { name: string } | null;',
    '  parent: { id: uuid; name: string } | null;',
    '};',
    '// Output: Label[]',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --limit 10',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  protected async execute(ctx: ExecCtxOf<this>): Promise<LabelNodes> {
    const parsedLimit = ctx.parsed.limit;
    const { client, cache } = resolveDeps<Pick<Sdk, 'GetIssueLabels'>>(
      ctx.deps,
      getLinearSdk
    );
    const labels = await listLabels({ limit: parsedLimit }, { client, cache });
    this.printRows(
      labels.map((label) => [
        label.id,
        label.name,
        label.team?.name ?? '',
        label.color ?? '',
      ])
    );
    return labels;
  }
}
