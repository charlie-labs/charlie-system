import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  zPositiveInt,
  zStringList,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type Sdk,
  type SearchIssuesQuery,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ValidationError as LibValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { searchIssues as searchIssuesOp } from '../../../lib/operations/issue/search-issues.js';
import { comparatorMapToSearchQualifiers } from '../../utils/date-filters.js';
import { normaliseMulti } from '../../utils/filters.js';
import {
  DATE_COMPARATOR_FLAG_DESCRIPTION,
  zDateComparatorMap,
} from '../../utils/flags/date.js';
import { userDisplayName } from '../../utils/format.js';
import { resolveLabelIds } from '../../utils/resolvers/index.js';

type SearchIssueNodes = SearchIssuesQuery['searchIssues']['nodes'];

/**
 * String-based search for issues in Linear.
 *
 * This command should be used only when you specifically need a
 * free-text search against Linear's search backend. Qualifier flags are
 * supported, but they are encoded into the search term string rather than
 * passed as structured filters.
 *
 * For list+filter style queries (teams, labels, states, creators, dates,
 * etc.) prefer `issue list`, which uses proper GraphQL filters and returns
 * predictable results.
 *
 * If the `--json` flag is provided the raw issue objects are printed as
 * pretty-printed JSON; otherwise each matching issue is shown on one line
 * in the form:
 *
 *   <identifier>\t<title>\t<state>\t<assignee>\t<delegate>
 */
const manifest = defineFlags({
  query: {
    oclif: Flags.string({
      char: 'q',
      description:
        'Free-text search query (alias for the positional `query` argument)',
      required: false,
    }),
    schema: z.string().optional(),
  },
  team: {
    oclif: Flags.string({
      char: 'T',
      description: 'Filter by team key (can be set multiple times)',
      multiple: true,
    }),
    schema: zStringList,
  },
  assignee: {
    oclif: Flags.string({
      char: 'a',
      description:
        'Filter by assignee text (passed to search), e.g., username or @mention',
    }),
    schema: z.string().optional(),
  },
  delegate: {
    oclif: Flags.string({
      description:
        'Filter by delegated agent text (passed to search), e.g., username or @mention. Alias: --agent. Encoded into the search term as agent:<value>.',
      aliases: ['agent'],
    }),
    schema: z.string().optional(),
  },
  state: {
    oclif: Flags.string({
      char: 's',
      description: 'Filter by workflow state name (can be set multiple times)',
      multiple: true,
    }),
    schema: zStringList,
  },
  label: {
    oclif: Flags.string({
      char: 'l',
      description:
        'Filter by label NAME or ID (case-insensitive, can be set multiple times)',
      multiple: true,
    }),
    schema: zStringList,
  },
  creator: {
    oclif: Flags.string({
      char: 'c',
      description: 'Filter by issue creator (user identifier, e.g. email)',
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
  sort: {
    oclif: Flags.string({
      description:
        'Sort results; allowed fields: created, updated, priority, title with optional :asc|desc order (e.g. "updated:desc")',
    }),
    schema: z.string().optional(),
  },
  limit: {
    oclif: Flags.integer({
      description: 'Maximum number of issues to return',
      default: 30,
      min: 1,
    }),
    schema: zPositiveInt({ default: 30 }),
  },
  archived: {
    oclif: Flags.boolean({
      description: 'Only archived issues',
      default: false,
      allowNo: true,
    }),
    schema: z.boolean().default(false),
  },
} as const);

export default class IssueSearch extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetIssueLabels' | 'SearchIssues'>>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'String-based issue search. Not for list+filter queries—use `issue list` for those.',
    '',
    'Output',
    '- TSV columns (in order): identifier, title, state, assignee, delegate',
    '- JSON shape:',
    '```ts',
    'type Issue = {',
    '  id: uuid;',
    '  identifier: string;',
    '  url: string;',
    '  team: { id: uuid; key: string; name: string };',
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

  // Alternative/back-compatibility command names (space-separated style)
  static aliases = ['issue list', 'issue query'];

  static examples = [
    '<%= config.bin %> <%= command.id %> "login bug"',
    '<%= config.bin %> <%= command.id %> -q "login" -T ENG -s "In Progress"',
    '<%= config.bin %> <%= command.id %> "bug" --archived --json',
    '<%= config.bin %> <%= command.id %> "timeout" -u ">=2025-01-01" --limit 50',
    // Agent/delegate search (encoded as agent:<value>)
    '<%= config.bin %> <%= command.id %> --delegate charlie --limit 20',
  ];

  static args = {
    query: Args.string({
      name: 'query',
      description: 'Free-text search query',
      required: false,
    }),
  };

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<SearchIssueNodes | void> {
    const { args } = await this.parse(IssueSearch);
    const flags = parsed;
    const query = (flags.query ?? args.query)?.trim();

    // Reject invocations without a search term. The maintainer requested that
    // callers use `issue list` instead when no free‑text query is provided.
    if (!query || query.trim().length === 0) {
      throw new LibValidationError(
        'No search term provided. Use `issue list` to list issues instead.'
      );
    }

    const terms: string[] = [];
    terms.push(query.trim());

    // Multi-value qualifiers
    normaliseMulti(flags.team).forEach((t) => terms.push(`team:${t}`));
    normaliseMulti(flags.state).forEach((s) => terms.push(`state:${s}`));

    // Resolve label values (names → ids) before composing the search term.
    // Batch the resolution to avoid repeated list fetches under the hood.
    const labelValues = normaliseMulti(flags.label);
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'GetIssueLabels' | 'SearchIssues'>
    >(deps, getLinearSdk);
    if (labelValues.length > 0) {
      const ids = await resolveLabelIds(labelValues, {}, { client, cache });
      for (const id of ids ?? []) terms.push(`label:${id}`);
    }

    // Single-value qualifiers
    if (flags.assignee?.trim()) {
      terms.push(`assignee:${flags.assignee.trim()}`);
    }

    if (flags.delegate?.trim()) {
      // Linear UI uses "Agent" for delegation; search operator is treated as agent:<value>
      terms.push(`agent:${flags.delegate.trim()}`);
    }

    if (flags.creator?.trim()) {
      terms.push(`creator:${flags.creator.trim()}`);
    }

    if (flags.updated) {
      terms.push(...comparatorMapToSearchQualifiers('updated', flags.updated));
    }

    if (flags.parent?.trim()) {
      terms.push(`parent:${flags.parent.trim()}`);
    }

    if (flags.archived) {
      terms.push('archived:true');
    }

    // --sort handling with validation
    if (flags.sort?.trim()) {
      const sortRaw = flags.sort.trim();
      const [fieldRaw, orderRaw, ...extra] = sortRaw.split(':');

      const allowedFields = [
        'created',
        'updated',
        'priority',
        'title',
      ] as const;
      const allowedOrders = ['asc', 'desc'] as const;

      // Normalise the order for case-insensitive handling (e.g. ASC → asc)
      const orderRawNorm = orderRaw?.toLowerCase();

      // Detect a trailing colon with no order (e.g. "created:")
      if (orderRaw === '') {
        throw new LibValidationError(
          `Invalid --sort value "${flags.sort}". Missing sort order after colon.`
        );
      }

      // Extra tokens after the second colon are not allowed (e.g. a :b :c)
      if (extra.length > 0) {
        throw new LibValidationError(
          `Invalid --sort value "${flags.sort}". Only one optional :asc|desc order is allowed.`
        );
      }

      if (!allowedFields.includes(fieldRaw as (typeof allowedFields)[number])) {
        throw new LibValidationError(
          `Invalid --sort field "${fieldRaw}". Allowed fields: ${allowedFields.join(', ')}`
        );
      }

      if (
        orderRawNorm &&
        !allowedOrders.includes(orderRawNorm as (typeof allowedOrders)[number])
      ) {
        throw new LibValidationError(
          `Invalid --sort order "${orderRaw}". Allowed orders: asc, desc`
        );
      }

      // Build sort qualifier – omit ":asc" when ascending is implied
      if (orderRawNorm === 'desc') {
        terms.push(`sort:${fieldRaw}:desc`);
      } else {
        // Default to ascending when "asc" is given or order is omitted
        terms.push(`sort:${fieldRaw}`);
      }
    }

    const term = terms.join(' ');
    const first = Number(flags.limit ?? 30);
    const issues = await searchIssuesOp({ term, first }, { client });

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
