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
  type CustomerNeedFilter,
  type CustomerNeedsQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listCustomerNeeds } from '../../../lib/operations/customer-need/list-customer-needs.js';
import { listCustomers } from '../../../lib/operations/customer/list-customers.js';

/** Convenience alias */
type NeedNodes = CustomerNeedsQuery['customerNeeds']['nodes'];

import {
  buildDateComparatorMap,
  formatDateErrorForFlag,
} from '../../utils/date-filters.js';
import { normaliseMulti } from '../../utils/filters.js';

const VALIDATION_ERROR_OPTIONS = { exit: 2, code: 'EVALIDATION' } as const;

const manifest = defineFlags({
  'customer-id': {
    oclif: Flags.string({
      description: 'Filter by customer ID',
      exclusive: ['customer-name'],
    }),
    schema: z.string().optional(),
  },
  'customer-name': {
    oclif: Flags.string({
      description: 'Filter by customer name (will resolve to ID)',
      exclusive: ['customer-id'],
    }),
    schema: z.string().optional(),
  },
  'issue-id': {
    oclif: Flags.string({
      description: 'Filter by issue ID',
    }),
    schema: z.string().optional(),
  },
  priority: {
    oclif: Flags.integer({
      description: 'Filter by priority (0 or 1)',
      min: 0,
      max: 1,
    }),
    schema: z.number().int().min(0).max(1).optional(),
  },
  created: {
    oclif: Flags.string({
      description: [
        'Filter by created-at date using comparators (repeatable).',
        'Accepted operators: >, >=, <, <=, =, or none (equality).',
        'Accepted formats: YYYY-MM-DD or full ISO-8601 with Z/offset.',
        'Operators are literal (< and > strict; <= and >= inclusive).',
        'May be set multiple times to express ranges; equality must not be combined with other operators.',
        'Note: wrap values containing < or > in quotes.',
      ].join(' '),
      multiple: true,
    }),
    schema: z.array(z.string()).optional(),
  },
  first: {
    oclif: Flags.integer({
      description: 'Page size (default 50)',
      default: 50,
    }),
    schema: zPositiveInt({ default: 50 }),
  },
  after: {
    oclif: Flags.string({ description: 'Pagination cursor' }),
    schema: z.string().optional(),
  },
  'pick-first': {
    oclif: Flags.boolean({
      description:
        'When resolving customer name, pick first match automatically',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
} as const);

export default class CustomerNeedList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<Partial<LinearDeps<'CustomerNeeds' | 'GetCustomers'>>>
  | Result<NeedNodes>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'Search customer needs with optional filters.',
    '',
    'Output',
    '- TSV columns (in order): id, customer, priority, created, body',
    '- JSON shape:',
    '```ts',
    'type CustomerNeed = {',
    '  id: uuid;',
    '  body: string | null;',
    '  priority: number;',
    '  createdAt: ISODate;',
    '  archivedAt: ISODate | null;',
    '  customer: { id: uuid; name: string } | null;',
    '  creator: { id: uuid; name: string | null; displayName: string | null } | null;',
    '  issue: { id: uuid; identifier: string } | null;',
    '  project: { id: uuid; name: string } | null;',
    '};',
    '// Output: CustomerNeed[]',
    '```',
  ].join('\n');

  static examples = [
    '$ <%= config.bin %> customer-need list --customer-name Acme',
    '$ <%= config.bin %> customer-need list --priority 1 --created ">=2025-01-01" --created "<2025-02-01"',
    '$ <%= config.bin %> customer-need list --customer-name Acme --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<NeedNodes> {
    const { client: linear, cache } = resolveDeps<
      Pick<Sdk, 'GetCustomers' | 'CustomerNeeds'>
    >(deps, getLinearSdk);
    const first = parsed.first;
    const after = parsed.after ?? undefined;

    /* ---------------- Resolve customerName → customerId ---------------- */
    let customerId: string | undefined = parsed['customer-id'];

    if (!customerId && parsed['customer-name']) {
      // Fetch all customers and filter locally since GetCustomers has no filter param
      const allCustomers = await listCustomers(
        { first: 100 },
        { client: linear, cache }
      );

      const matches = allCustomers.filter((c) =>
        c.name.toLowerCase().includes(parsed['customer-name']!.toLowerCase())
      );

      if (matches.length === 0) {
        this.error(`No customer matches "${parsed['customer-name']}"`, {
          ...VALIDATION_ERROR_OPTIONS,
        });
      }
      if (matches.length > 1 && !parsed['pick-first']) {
        const list = matches.map((c) => `${c.name} (${c.id})`).join(', ');
        this.error(
          `Ambiguous customer name "${parsed['customer-name']}". Matches: ${list}. Use --pick-first to select the first result or provide an ID.`,
          { ...VALIDATION_ERROR_OPTIONS }
        );
      }
      customerId = matches[0]!.id;
    }

    /* ---------------- Build GraphQL filter object ----------------------
       CustomerNeedFilter expects:
         {
           customer: {            // NullableCustomerFilter
             id: { eq: <ID> }     // IDComparator
           },
           ...
         }
       Using a top-level `customerId` causes BAD_USER_INPUT errors.
    -------------------------------------------------------------------- */
    const filter: Partial<CustomerNeedFilter> = {};

    if (customerId) {
      filter.customer = { id: { eq: customerId } };
    }
    if (parsed['issue-id']) {
      filter.issue = { id: { eq: parsed['issue-id'] } };
    }
    if (parsed.priority !== undefined) {
      filter.priority = { eq: parsed.priority };
    }

    // Validate `--created` comparators and build filter
    const createdRaw = parsed.created;
    if (createdRaw !== undefined) {
      try {
        const createdVals = normaliseMulti(createdRaw);
        const createdMap = buildDateComparatorMap(createdVals);
        if (Object.keys(createdMap).length > 0) {
          filter.createdAt = createdMap;
        }
      } catch (err) {
        const msg = formatDateErrorForFlag(err, 'created');
        this.error(msg, { ...VALIDATION_ERROR_OPTIONS });
      }
    }

    /* ---------------- Fetch needs via pagination ----------------------- */
    const needs: NeedNodes = await listCustomerNeeds(
      {
        filter: Object.keys(filter).length
          ? (filter as CustomerNeedFilter)
          : undefined,
        first,
        after,
      },
      { client: linear, cache }
    );

    /* ---------------- Output ---------------- */
    this.printRows(
      needs.map((need) => [
        need.id,
        need.customer?.name ?? '',
        String(need.priority),
        new Date(need.createdAt).toLocaleDateString(),
        (need.body ?? '').replace(/\s+/g, ' '),
      ])
    );
    return needs;
  }
}
