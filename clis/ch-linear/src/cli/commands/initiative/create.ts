import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type CreateInitiativeMutation,
  type InitiativeCreateInput,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { normalizeStatus } from '../../utils/normalize-status.js';

const manifest = defineFlags({
  name: {
    oclif: Flags.string({
      char: 'n',
      description: 'Initiative name',
      required: true,
    }),
    schema: z.string().trim().min(1, 'Name is required'),
  },
  description: {
    oclif: Flags.string({
      char: 'd',
      description: 'Initiative description (markdown)',
    }),
    schema: z.string().optional(),
  },
  'target-date': {
    oclif: Flags.string({
      char: 'T',
      description: 'Target date (YYYY-MM-DD or ISO-8601)',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  color: {
    oclif: Flags.string({
      char: 'c',
      description: 'Hex color (e.g., #FF0000)',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  status: {
    oclif: Flags.string({
      char: 's',
      description: 'Initiative status (planned|active|completed)',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

/**
 * Create a new Linear initiative.
 *
 *   $ <%= config.bin %> initiative create --name "Launch V2" --status "planned"
 */
export default class InitiativeCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'CreateInitiative'>>
  | Result<{
      initiative: NonNullable<
        CreateInitiativeMutation['initiativeCreate']['initiative']
      >;
    }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Create a new Linear initiative.',
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
    '$ <%= config.bin %> <%= command.id %> --name "Launch V2" --status planned',
    '$ <%= config.bin %> <%= command.id %> -n "Perf Revamp" --target-date 2025-12-31 --color #FF8800 --json',
  ];

  protected override async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    initiative: NonNullable<
      CreateInitiativeMutation['initiativeCreate']['initiative']
    >;
  }> {
    const { client } = resolveDeps<Pick<Sdk, 'CreateInitiative'>>(
      deps,
      getLinearSdk
    );

    const input: InitiativeCreateInput = {
      name: parsed.name.trim(),
    };
    if (parsed.description) {
      input.description = await formatForLinearString(parsed.description);
    }
    if (parsed.color) input.color = parsed.color;

    if (parsed['target-date']) {
      const raw = parsed['target-date'].trim();
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

    try {
      if (parsed.status) {
        // Normalising inside the try-block ensures validation errors are caught
        const status = normalizeStatus(parsed.status);
        if (status !== undefined) input.status = status;
      }

      const resp = await client.CreateInitiative({ input });
      const initiative = resp.initiativeCreate.initiative;
      if (!initiative) {
        this.error('Initiative creation failed – no initiative returned.');
      }
      this.logInfo(`✓ Created initiative ${initiative.id}: ${initiative.name}`);
      // JSON mode: return a single-key wrapper { initiative }
      return { initiative };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message);
    }
  }
}
