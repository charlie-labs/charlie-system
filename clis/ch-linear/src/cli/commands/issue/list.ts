import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
  zPositiveInt,
  zStringList,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type ListIssuesQuery,
  type PaginationOrderBy,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listIssues } from '../../../lib/operations/issue/list-issues.js';
import { normaliseMulti, resolveMulti } from '../../utils/filters.js';
import {
  DATE_COMPARATOR_FLAG_DESCRIPTION,
  type DateComparatorMap,
  zDateComparatorMap,
} from '../../utils/flags/date.js';
import { userDisplayName } from '../../utils/format.js';
import {
  resolveIssueId,
  resolveLabelIds,
  resolveTeamId,
  resolveUserId,
  resolveWorkflowStateIds,
} from '../../utils/resolvers/index.js';

/**
 * Structured listing of Linear issues via the `issues` GraphQL query.
 *
 * Prefer this command for list+filter style queries (team, label, state,
 * creator, date ranges, parent, etc.).
 *
 * Unlike `issue search`, no free-text term is used here. All filters are
 * passed as proper GraphQL arguments for predictable results.
 */
type IssueNodes = ListIssuesQuery['issues']['nodes'];

const manifest = defineFlags({
  team: {
    oclif: Flags.string({
      char: 'T',
      description: 'Filter by team key/slug/UUID (can be set multiple times)',
      multiple: true,
    }),
    schema: zStringList,
  },
  label: {
    oclif: Flags.string({
      char: 'l',
      description: 'Filter by label NAME or ID (can be set multiple times)',
      multiple: true,
    }),
    schema: zStringList,
  },
  state: {
    oclif: Flags.string({
      char: 's',
      description:
        'Filter by workflow state NAME or ID (can be set multiple times)',
      multiple: true,
    }),
    schema: zStringList,
  },
  assignee: {
    oclif: Flags.string({
      char: 'a',
      description: 'Filter by assignee (username/name, email, or UUID)',
    }),
    schema: z.string().optional(),
  },
  delegate: {
    oclif: Flags.string({
      description:
        'Filter by delegated agent (username/name, email, or UUID). Alias: --agent',
      aliases: ['agent'],
    }),
    schema: z.string().optional(),
  },
  creator: {
    oclif: Flags.string({
      char: 'c',
      description:
        'Filter by issue creator (user identifier, e.g. email/username, or UUID)',
    }),
    schema: z.string().optional(),
  },
  updated: {
    oclif: Flags.string({
      char: 'u',
      multiple: true,
      description: DATE_COMPARATOR_FLAG_DESCRIPTION,
    }),
    schema: zDateComparatorMap('updated'),
  },
  parent: {
    oclif: Flags.string({
      char: 'p',
      description: 'Filter by parent issue identifier or ID',
    }),
    schema: z.string().optional(),
  },
  cycle: {
    oclif: Flags.string({
      description:
        'Filter by cycle. Supported value: "current" (issues in the active cycle of their team).',
      options: ['current'],
    }),
    schema: z.enum(['current']).optional(),
  },
  archived: {
    oclif: Flags.boolean({
      description: 'Only archived issues',
      default: false,
      allowNo: true,
    }),
    schema: z.boolean().default(false),
  },
  created: {
    oclif: Flags.string({
      multiple: true,
      description: DATE_COMPARATOR_FLAG_DESCRIPTION,
    }),
    schema: zDateComparatorMap('created'),
  },
  sort: {
    oclif: Flags.string({
      description: 'Sort by createdAt | updatedAt',
      default: 'createdAt',
      options: ['createdAt', 'updatedAt'],
    }),
    // Restrict schema to the allowed fields to keep manifest truthful to the flag
    schema: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  },
  limit: {
    oclif: Flags.integer({
      description: 'Maximum number of issues to return',
      default: 30,
      min: 1,
    }),
    schema: zPositiveInt({ default: 30 }),
  },
  first: {
    oclif: Flags.integer({
      description: 'DEPRECATED: use --limit',
      hidden: true,
      min: 1,
    }),
    schema: zPositiveInt({}).optional(),
  },
  after: {
    oclif: Flags.string({
      description: 'Pagination cursor for the first request',
    }),
    schema: z.string().optional(),
  },
} as const);

export default class IssueList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'ListIssues' | 'GetIssueLabels' | 'GetUsers'>>
  | Result<IssueNodes>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'List Linear issues using structured filters (team, label, state, etc.).',
    '',
    'Output',
    '- TSV columns (in order): identifier, title, state, assignee, delegate',
    '- JSON shape:',
    '```ts',
    'type Issue = {',
    '  id: uuid;',
    '  identifier: string;',
    '  title: string;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '  completedAt: ISODate | null;',
    '  canceledAt: ISODate | null;',
    '  estimate: number | null;',
    '  priority: number;',
    '  priorityLabel: string;',
    '  state: { id: uuid; name: string; type: string } | null;',
    '  assignee: { id: uuid; displayName: string | null; name: string | null } | null;',
    '  delegate: { id: uuid; displayName: string | null; name: string | null } | null;',
    '  labels: { nodes: { id: uuid; name: string; color: string | null }[] } | null;',
    '};',
    '// Output: Issue[]',
    '```',
  ].join('\n');

  // flags are registered via manifest

  static examples = [
    // Labels (multi) + States (multi)
    '$ <%= config.bin %> <%= command.id %> -l bug -l "good first issue" -s "In Progress" -s Done',

    // Assignee (user identifier)
    '$ <%= config.bin %> <%= command.id %> --assignee alice',

    // Parent issue by identifier or ID
    '$ <%= config.bin %> <%= command.id %> --parent LIN-123',

    // Updated filter (comparators supported: >, <, >=, <=, =; showing equality)
    '$ <%= config.bin %> <%= command.id %> --updated "=2025-08-01"',

    // Created one-sided
    '$ <%= config.bin %> <%= command.id %> --created ">2025-01-01"',
    '$ <%= config.bin %> <%= command.id %> --created "<=2025-01-31"',

    // Created two-sided range
    '$ <%= config.bin %> <%= command.id %> --created ">=2025-01-01" --created "<2025-02-01"',

    // Created equality (UTC day)
    '$ <%= config.bin %> <%= command.id %> --created "2025-01-15"',

    // Archived-only
    '$ <%= config.bin %> <%= command.id %> --archived',

    // Sorting (field only; no direction)
    '$ <%= config.bin %> <%= command.id %> --sort updatedAt',

    // Team filter (multi-use)
    '$ <%= config.bin %> <%= command.id %> -T ENG -T MKT',

    // Current cycle across teams
    '$ <%= config.bin %> <%= command.id %> --cycle current',
    '$ <%= config.bin %> <%= command.id %> --cycle current --json',

    // Pagination example (cursor)
    '$ <%= config.bin %> <%= command.id %> --after abc123',

    // Combined scenario (team + state + assignee + sort + limit) with JSON output
    '$ <%= config.bin %> <%= command.id %> -T ENG -s "In Progress" -a alice --sort updatedAt --limit 20 --json',
  ];

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<IssueNodes> {
    const flags = parsed;

    // Resolve SDK deps once and reuse for label/user resolution and final operation
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'ListIssues' | 'GetIssueLabels' | 'GetUsers'>
    >(deps, getLinearSdk);

    /* -------------------------- 1. Resolve IDs --------------------------- */

    // team filter
    const teamVals = normaliseMulti(flags.team);
    const teamIdsRaw = teamVals.length
      ? await resolveMulti(teamVals, resolveTeamId)
      : [];
    const teamIds = teamIdsRaw.filter(
      (v): v is string => typeof v === 'string'
    );

    // labels filter
    const labelVals = normaliseMulti(flags.label);
    let labelIds: string[] | undefined;
    if (labelVals.length) {
      // Resolve one-by-one to preserve original semantics (skip unresolved)
      const resolved = await resolveLabelIds(
        labelVals,
        {},
        {
          client,
          cache,
        }
      );
      labelIds = resolved;
      if (!resolved || resolved.length === 0) {
        this.logWarn(
          'All provided --label values are non-UUIDs or could not be resolved; ignoring label filter.'
        );
      }
    }

    // state filter
    const stateVals = normaliseMulti(flags.state);
    const stateIds = stateVals.length
      ? ((await resolveWorkflowStateIds(stateVals, { teamIds })) ?? [])
      : [];

    if (stateVals.length > 0 && stateIds.length === 0) {
      const scopeMsg = teamIds.length
        ? ` within the specified team filter (${teamVals.join(', ')})`
        : ' across any team';
      this.logWarn(
        `No workflow states matched ${JSON.stringify(stateVals)}${scopeMsg}; ignoring --state filter.`
      );
    }

    // assignee filter
    let assigneeId: string | undefined;
    if (flags.assignee) {
      assigneeId = await resolveUserId(flags.assignee, {
        client,
        cache,
      });
    }

    // delegate/agent filter
    let delegateId: string | undefined;
    if (flags.delegate) {
      delegateId = await resolveUserId(flags.delegate, {
        client,
        cache,
      });
    }

    // creator filter
    let creatorId: string | undefined;
    if (flags.creator) {
      creatorId = await resolveUserId(flags.creator, {
        client,
        cache,
      });
    }

    // parent issue filter
    let parentId: string | undefined;
    if (flags.parent) {
      parentId = await resolveIssueId(flags.parent);
    }

    /* ------------------------- 2. Sort handling -------------------------- */

    let orderBy: PaginationOrderBy | undefined;
    if (flags.sort) {
      const [fieldRaw = '', dirRaw] = flags.sort.split(':');

      if (dirRaw !== undefined) {
        this.error(
          '--sort does not support direction (asc/desc). Use createdAt or updatedAt only.',
          { exit: 2 }
        );
      }

      const allowedFields = ['createdAt', 'updatedAt'] as const;
      const isAllowed = allowedFields.includes(
        fieldRaw as (typeof allowedFields)[number]
      );
      if (!fieldRaw || !isAllowed) {
        this.error(
          `Invalid --sort field "${fieldRaw}". Allowed fields: ${allowedFields.join(', ')}`,
          { exit: 2 }
        );
      }

      orderBy = fieldRaw as PaginationOrderBy;
    }

    // updated/created comparator maps are produced by the schema
    const updatedAt: DateComparatorMap | undefined = flags.updated;
    const createdAt: DateComparatorMap | undefined = flags.created;

    /* ----------------------- 3. Execute operation ------------------------ */

    const issues = await listIssues(
      {
        teamIds: teamIds.length ? teamIds : undefined,
        labelIds: labelIds && labelIds.length ? labelIds : undefined,
        stateIds: stateIds.length ? stateIds : undefined,
        assigneeId,
        creatorId,
        delegateId,
        parentId,
        activeCycle: flags.cycle === 'current' ? true : undefined,
        updatedAt,
        createdAt,
        orderBy: orderBy as 'createdAt' | 'updatedAt' | undefined,
        archived: flags.archived,
        first: flags.first ?? flags.limit,
        after: flags.after,
      },
      { client, cache }
    );

    // Print rows (TSV output suppressed automatically in JSON mode)
    const rows = issues.map((issue) => [
      issue.identifier,
      issue.title,
      issue.state?.name ?? '',
      userDisplayName(issue.assignee),
      userDisplayName(issue.delegate),
    ]);

    const header = ['identifier', 'title', 'state', 'assignee', 'delegate'];

    this.printRows(rows, { header });

    return issues;
  }
}
