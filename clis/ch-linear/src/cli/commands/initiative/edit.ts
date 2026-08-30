import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type InitiativeUpdateInput,
  type Sdk,
  type UpdateInitiativeMutation,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { normalizeStatus } from '../../utils/normalize-status.js';
import { resolveInitiativeId } from '../../utils/resolvers/index.js';

const manifest = defineFlags({
  name: {
    oclif: Flags.string({ description: 'New initiative name' }),
    schema: z.string().trim().min(1).optional(),
  },
  description: {
    oclif: Flags.string({ description: 'New description (markdown)' }),
    schema: z.string().optional(),
  },
  'target-date': {
    oclif: Flags.string({ description: 'New target date (YYYY-MM-DD or ISO)' }),
    schema: z.string().trim().min(1).optional(),
  },
  color: {
    oclif: Flags.string({ description: 'Hex color (e.g., #00FF00)' }),
    schema: z.string().trim().min(1).optional(),
  },
  status: {
    oclif: Flags.string({
      description: 'New status (planned|active|completed)',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

/**
 * Update fields on an existing Linear initiative.
 *
 *   $ <%= config.bin %> initiative edit "Cloud Migration" --status "active"
 */
export default class InitiativeEdit extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'UpdateInitiative' | 'GetInitiatives' | 'GetInitiative'>>
  | Result<{
      initiative: NonNullable<
        UpdateInitiativeMutation['initiativeUpdate']['initiative']
      >;
    }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Update an existing Linear initiative.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type Initiative = {',
    '  id: uuid;',
    '  name: string;',
    '  description: string | null;',
    '  targetDate: ISODate | null;',
    '  startedAt: ISODate | null;',
    '  completedAt: ISODate | null;',
    '  color: string | null;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '};',
    '// Output: { initiative: Initiative }',
    '```',
  ].join('\n');

  static examples = [
    '$ <%= config.bin %> <%= command.id %> 123e4567-e89b-12d3-a456-426614174000 --name "New name"',
    '$ <%= config.bin %> <%= command.id %> "Cloud Migration" --status active --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Initiative UUID or name',
    }),
  } as const;

  protected override async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    initiative: NonNullable<
      UpdateInitiativeMutation['initiativeUpdate']['initiative']
    >;
  }> {
    const { args } = await this.parse(InitiativeEdit);
    const { client } = resolveDeps<
      Pick<Sdk, 'UpdateInitiative' | 'GetInitiatives' | 'GetInitiative'>
    >(deps, getLinearSdk);

    if (
      !parsed.name &&
      !parsed.description &&
      !parsed['target-date'] &&
      !parsed.color &&
      !parsed.status
    ) {
      this.error('No changes specified – supply at least one mutating flag.');
    }

    const initiativeId = await resolveInitiativeId(args.id);
    if (!initiativeId) {
      this.error('Unable to resolve initiative id.');
    }

    const input: InitiativeUpdateInput = {};
    if (parsed.name) input.name = parsed.name.trim();
    if (parsed.description) {
      input.description = await formatForLinearString(parsed.description);
    }
    if (parsed.color) input.color = parsed.color;
    if (parsed['target-date'] !== undefined) {
      const raw = parsed['target-date'].trim();
      if (raw.toLowerCase() === 'clear') {
        input.targetDate = null;
      } else {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? new Date(`${raw}T00:00:00Z`)
          : new Date(raw);
        if (Number.isNaN(date.getTime())) {
          this.error(
            `Invalid date "${raw}" for --target-date. Provide YYYY-MM-DD or a valid ISO-8601 string.`
          );
        }
        input.targetDate = date.toISOString();
      }
    }

    try {
      if (parsed.status) {
        // Normalising inside the try-block so any validation errors propagate to catch
        const status = normalizeStatus(parsed.status);
        if (status !== undefined) input.status = status;
      }

      const resp = await client.UpdateInitiative({ id: initiativeId, input });
      const init = resp.initiativeUpdate.initiative;
      if (!init) {
        this.error('Initiative update failed.');
      }
      this.logInfo(`✓ Updated initiative ${init.id}: ${init.name}`);
      // JSON mode: return a single-key wrapper { initiative }
      return { initiative: init };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message);
    }
  }
}
