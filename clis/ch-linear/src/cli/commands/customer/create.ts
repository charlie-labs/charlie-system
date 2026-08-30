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
  type CustomerCreateInput,
  type CustomerCreateMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ApiRequestError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createCustomer as createCustomerOp } from '../../../lib/operations/customer/create-customer.js';
import {
  resolveCustomerStatusId,
  resolveCustomerTierId,
} from '../../utils/resolvers/index.js';

type CustomerPayload = {
  customer: NonNullable<CustomerCreateMutation['customerCreate']['customer']>;
};

const manifest = defineFlags({
  name: {
    oclif: Flags.string({
      description: 'Customer name',
      required: true,
    }),
    schema: z.string(),
  },
  'tier-id': {
    oclif: Flags.string({
      description: 'Tier ID to assign',
      exclusive: ['tier-name'],
    }),
    schema: z.string().optional(),
  },
  'tier-name': {
    oclif: Flags.string({
      description: 'Tier name – will be resolved to an ID',
      exclusive: ['tier-id'],
    }),
    schema: z.string().optional(),
  },
  'status-id': {
    oclif: Flags.string({
      description: 'Status ID to assign',
      exclusive: ['status-name'],
    }),
    schema: z.string().optional(),
  },
  'status-name': {
    oclif: Flags.string({
      description: 'Status name – will be resolved to an ID',
      exclusive: ['status-id'],
    }),
    schema: z.string().optional(),
  },
} as const);

export default class CustomerCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'CustomerCreate'>>
  | Result<CustomerPayload>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Create a new Customer.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type Customer = {',
    '  id: uuid;',
    '  name: string;',
    '  status: { id: uuid; name: string } | null;',
    '  tier: { id: uuid; name: string } | null;',
    '};',
    '// Output: { customer: Customer }',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> --name "Acme Co"',
    '<%= config.bin %> <%= command.id %> --name "Acme Co" --tier-id TIER_GOLD --status-name Active --json',
  ];

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<CustomerPayload> {
    const { client } = resolveDeps<Pick<Sdk, 'CustomerCreate'>>(
      deps,
      getLinearSdk
    );

    /* ---------- Resolve tier / status names → IDs ---------- */
    // If explicit IDs are provided, use them directly and skip any resolver
    // logic that would fetch lists (avoids requiring a real API client/env in
    // tests and respects the "-id" flags literally). Only call the resolvers
    // when a human-readable name is supplied.
    const tierId =
      parsed['tier-id'] ?? (await resolveCustomerTierId(parsed['tier-name']));
    const statusId =
      parsed['status-id'] ??
      (await resolveCustomerStatusId(parsed['status-name']));

    /* ---------- Build mutation input ----------------------- */
    const name = parsed.name.trim();
    if (!name) {
      this.error('Name cannot be empty.');
    }
    const input: CustomerCreateInput = {
      name,
      ...(tierId ? { tierId } : {}),
      ...(statusId ? { statusId } : {}),
    };

    /* ---------- Perform mutation --------------------------- */
    const payload = await createCustomerOp({ input }, { client });
    if (!payload.customer) {
      throw new ApiRequestError(
        'Linear API reported a failure while creating the customer'
      );
    }
    this.logInfo(payload.customer.id);
    // JSON mode: return a single-key wrapper { customer }
    return { customer: payload.customer };
  }
}
