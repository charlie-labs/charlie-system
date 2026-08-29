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
import { z } from 'zod3';

import {
  type GetCustomersQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listCustomers } from '../../../lib/operations/customer/list-customers.js';

/** Convenience alias for the array of customer nodes */
type CustomerNodes = GetCustomersQuery['customers']['nodes'];

const manifest = defineFlags({
  name: {
    oclif: Flags.string({
      char: 'n',
      description: 'Substring match on customer name',
    }),
    schema: z.string().optional(),
  },
  status: {
    oclif: Flags.string({
      description: 'Status ID (or name)',
    }),
    schema: z.string().optional(),
  },
  tier: {
    oclif: Flags.string({
      description: 'Tier ID (or name)',
    }),
    schema: z.string().optional(),
  },
  first: {
    oclif: Flags.integer({
      description: 'Number of customers to fetch per request (default 50)',
      default: 50,
      min: 1,
    }),
    schema: zPositiveInt({ default: 50 }),
  },
  after: {
    oclif: Flags.string({
      description: 'Pagination cursor (applied to the first request only)',
    }),
    schema: z.string().optional(),
  },
} as const);

export default class CustomerList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetCustomers'>>
  | Result<CustomerNodes>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Search customers by name, status, or tier.',
    '',
    'Output',
    '- TSV columns (in order): id, name, status, tier',
    '- JSON shape:',
    '```ts',
    'type Customer = {',
    '  id: uuid;',
    '  name: string;',
    '  status: { id: uuid; name: string } | null;',
    '  tier: { id: uuid; name: string } | null;',
    '};',
    '// Output: Customer[]',
    '```',
  ].join('\n');

  static examples = [
    '$ <%= config.bin %> customer list',
    '$ <%= config.bin %> customer list --name "Acme"',
    '$ <%= config.bin %> customer list --tier gold --json',
  ];

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<CustomerNodes> {
    const { client, cache } = resolveDeps<Pick<Sdk, 'GetCustomers'>>(
      deps,
      getLinearSdk
    );
    const customers: CustomerNodes = await listCustomers(
      { first: parsed.first, after: parsed.after },
      { client, cache }
    );

    // 2. Apply local filtering ------------------------------------------------
    const filtered = customers.filter((cust) => {
      // name filter – case-insensitive substring match
      if (parsed.name) {
        const haystack = cust.name?.toLowerCase() ?? '';
        if (!haystack.includes(parsed.name.toLowerCase())) return false;
      }

      // status filter – match against status.id OR status.name
      if (parsed.status) {
        const statusId = cust.status?.id;
        const statusName = cust.status?.name;
        if (
          parsed.status !== statusId &&
          parsed.status?.toLowerCase() !== statusName?.toLowerCase()
        ) {
          return false;
        }
      }

      // tier filter – match against tier.id OR tier.name
      if (parsed.tier) {
        const tierId = cust.tier?.id;
        const tierName = cust.tier?.name;
        if (
          parsed.tier !== tierId &&
          parsed.tier?.toLowerCase() !== tierName?.toLowerCase()
        ) {
          return false;
        }
      }

      return true;
    });

    // 3. Output ---------------------------------------------------------------
    this.printRows(
      filtered.map((cust) => [
        cust.id,
        cust.name,
        cust.status?.name ?? '',
        cust.tier?.name ?? '',
      ])
    );
    return filtered;
  }
}
