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
  type CustomerNeedCreateInput,
  type CustomerNeedCreateMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createCustomerNeed as createCustomerNeedOp } from '../../../lib/operations/customer-need/create-customer-need.js';
import { listCustomers } from '../../../lib/operations/customer/list-customers.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';

/** Convenience UUID-v4 matcher */
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeId(value?: string): boolean {
  return !!value && uuidV4.test(value);
}

type MutationNeed = NonNullable<
  CustomerNeedCreateMutation['customerNeedCreate']['need']
>;

const VALIDATION_ERROR_OPTIONS = { exit: 2, code: 'EVALIDATION' } as const;
const API_ERROR_OPTIONS = { exit: 1, code: 'EAPI' } as const;

const manifest = defineFlags({
  'customer-id': {
    oclif: Flags.string({
      description: 'Customer ID',
      exclusive: ['customer-name'],
    }),
    schema: z.string().optional(),
  },
  'customer-name': {
    oclif: Flags.string({
      description: 'Customer name – will be resolved to ID',
      exclusive: ['customer-id'],
    }),
    schema: z.string().optional(),
  },
  'issue-id': {
    oclif: Flags.string({
      description:
        'Linear issue to link – accepts a UUID or an identifier such as ABC-123',
    }),
    schema: z.string().optional(),
  },
  body: {
    oclif: Flags.string({
      description: 'Need description/body',
      required: true,
    }),
    schema: z.string().min(1, 'body is required'),
  },
  priority: {
    oclif: Flags.integer({
      description: 'Priority (0 = normal, 1 = important)',
      default: 0,
      min: 0,
      max: 1,
    }),
    schema: z.number().int().min(0).max(1).default(0),
  },
  'pick-first': {
    oclif: Flags.boolean({
      description:
        'When resolving customer by name, pick the first match instead of erroring on ambiguity',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
} as const);

export default class CustomerNeedCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<
      Partial<
        LinearDeps<
          'CustomerNeedCreate' | 'GetCustomers' | 'GetIssueByIdentifier'
        >
      >
    >
  | Result<{ customerNeed: MutationNeed }>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'Create a new Customer-Need and (optionally) link it to an Issue.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type CustomerRef = { id: uuid; name: string } | null;',
    'type IssueRef = { id: uuid; identifier: string } | null;',
    'type CustomerNeed = {',
    '  id: uuid;',
    '  body: string | null;',
    '  priority: number;',
    '  createdAt: ISODate;',
    '  archivedAt: ISODate | null;',
    '  customer: CustomerRef;',
    '  issue: IssueRef;',
    '};',
    '// Output: { customerNeed: CustomerNeed }',
    '```',
  ].join('\n');

  static examples = [
    '$ <%= config.bin %> customer-need create --customer-id CUST_123 ' +
      '--issue-id ABC-123 --body "Export CSV" --priority 1',
    '$ <%= config.bin %> customer-need create --customer-name Acme ' +
      '--body "Export CSV" --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ customerNeed: MutationNeed }> {
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'CustomerNeedCreate' | 'GetCustomers' | 'GetIssueByIdentifier'>
    >(deps, getLinearSdk);

    /* ---------- Resolve customer ID ------------------------ */
    let customerId = parsed['customer-id'];
    if (!customerId) {
      customerId = await this.resolveCustomerId(
        parsed['customer-name'],
        parsed['pick-first'],
        client,
        cache
      );
    }
    if (!customerId) {
      this.error('Either --customer-id or --customer-name is required', {
        ...VALIDATION_ERROR_OPTIONS,
      });
    }

    /* ---------- Build mutation input ----------------------- */
    const body = await formatForLinearString(parsed.body);
    const input: CustomerNeedCreateInput = {
      customerId,
      body,
      priority: parsed.priority,
      ...(parsed['issue-id']
        ? { issueId: await this.resolveIssueId(parsed['issue-id'], client) }
        : {}),
    };

    /* ---------- Perform mutation --------------------------- */
    const payload = await createCustomerNeedOp({ input }, { client });
    if (!payload.need) {
      this.error('Linear API reported a failure while creating the need', {
        ...API_ERROR_OPTIONS,
      });
    }
    if (!this.jsonEnabled()) {
      this.log(payload.need.id);
    }
    // JSON mode: return a single-key wrapper { customerNeed }
    return { customerNeed: payload.need };
  }

  /* -------------------------------------------------------- */
  private async resolveCustomerId(
    name: string | undefined,
    pickFirst: boolean,
    client: Pick<Sdk, 'GetCustomers'>,
    cache: LinearDeps<'GetCustomers'>['cache']
  ): Promise<string | undefined> {
    if (!name) return undefined;
    if (looksLikeId(name)) return name;

    const customers = await listCustomers({ first: 100 }, { client, cache });
    const matches = customers.filter((c) =>
      c.name.toLowerCase().includes(name.toLowerCase())
    );

    if (matches.length === 0) {
      this.error(`No customers match "${name}"`, {
        ...VALIDATION_ERROR_OPTIONS,
      });
    }
    if (matches.length > 1 && !pickFirst) {
      const list = matches.map((c) => `${c.name} (${c.id})`).join(', ');
      this.error(
        `Ambiguous customer name "${name}". Matches: ${list}. ` +
          'Use --pick-first to pick the first result or provide an ID.',
        { ...VALIDATION_ERROR_OPTIONS }
      );
    }

    return matches[0]!.id;
  }

  /* -------------------------------------------------------- */
  /**
   * Accepts either a UUID or a human-readable identifier (e.g. ABC-123)
   * and resolves it to the canonical Issue UUID expected by Linear.
   */
  private async resolveIssueId(
    value: string,
    client: Pick<Sdk, 'GetIssueByIdentifier'>
  ): Promise<string> {
    if (looksLikeId(value)) return value;

    // We deliberately request only two results – unique identifiers *should*
    // return a single exact hit. More than one means ambiguity that we must
    // surface to the user.
    const { searchIssues } = await client.GetIssueByIdentifier({
      identifier: value,
      first: 2,
    });

    const exactMatches = searchIssues.nodes.filter(
      (n) => n.identifier.toLowerCase() === value.toLowerCase()
    );

    if (exactMatches.length === 1) return exactMatches[0]!.id;

    if (exactMatches.length === 0) {
      this.error(`No issue matches identifier "${value}"`, {
        ...VALIDATION_ERROR_OPTIONS,
      });
    }

    // Multiple exact matches (extremely unlikely) – treat as ambiguous
    const list = exactMatches.map((n) => n.identifier).join(', ');
    this.error(
      `Ambiguous issue identifier "${value}". Matches: ${list}. ` +
        'Please specify the issue UUID instead.',
      { ...VALIDATION_ERROR_OPTIONS }
    );
  }
}
