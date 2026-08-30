import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
  zPositiveInt,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type ListDocumentsQuery,
  type Sdk,
  type SearchDocumentsQuery,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ValidationError as LibValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { searchDocuments as searchDocumentsOp } from '../../../lib/operations/document/search-documents.js';
import {
  buildDateComparatorMap,
  comparatorMapToSearchQualifiers,
  formatDateErrorForFlag,
} from '../../utils/date-filters.js';
import { documentToTsv } from '../../utils/document.js';
import { normaliseMulti } from '../../utils/filters.js';

const manifest = defineFlags({
  team: {
    oclif: Flags.string({
      char: 'T',
      description: 'Filter by team key (can be set multiple times)',
      multiple: true,
    }),
    schema: z.array(z.string()).default([]),
  },
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'Filter by project name (can be set multiple times)',
      multiple: true,
    }),
    schema: z.array(z.string()).default([]),
  },
  creator: {
    oclif: Flags.string({
      char: 'c',
      description: 'Filter by creator (user identifier)',
    }),
    schema: z.string().optional(),
  },
  updated: {
    oclif: Flags.string({
      char: 'u',
      multiple: true,
      description: [
        'Filter by updated date with comparison operators.',
        'Accepted operators: >, >=, <, <=, =, or none (equality).',
        'Accepted formats: YYYY-MM-DD or full ISO-8601 with Z/offset.',
        'Operators are literal (< and > strict; <= and >= inclusive).',
        'May be set multiple times to express ranges; equality must not be combined with other operators.',
        'Note: wrap values containing < or > in quotes.',
      ].join(' '),
    }),
    schema: z.array(z.string()).default([]),
  },
  sort: {
    oclif: Flags.string({
      description:
        'Sort by "created" | "updated" with optional :asc|desc order',
    }),
    schema: z.string().optional(),
  },
  limit: {
    oclif: Flags.integer({
      description: 'Maximum number of results',
      default: 30,
      min: 1,
    }),
    schema: zPositiveInt({ default: 30 }),
  },
} as const);

type DocumentSearchResult = (
  | SearchDocumentsQuery['searchDocuments']['nodes'][number]
  | ListDocumentsQuery['documents']['nodes'][number]
)[];

export default class DocumentSearch extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'SearchDocuments' | 'ListDocuments'>>
  | Result<DocumentSearchResult>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'Search and list Linear documents.',
    '',
    'Output',
    '- TSV columns (in order): slugId, title, project, creator',
    '- JSON shape:',
    '```ts',
    'type Document = {',
    '  id: uuid;',
    '  slugId: string | null;',
    '  title: string | null;',
    '  project: { name: string } | null;',
    '  creator: { displayName: string | null; name: string | null } | null;',
    '};',
    '// Output: Document[]',
    '```',
  ].join('\n');

  // `document list` is an alias for this command with no free-text query.
  static aliases = ['document list'];

  static examples = [
    '<%= config.bin %> document search "architecture"',
    '<%= config.bin %> document search -T ENG -p "Project X"',
    '<%= config.bin %> document list --limit 50',
    '<%= config.bin %> document search "architecture" --json',
  ];

  static args = {
    query: Args.string({
      description: 'Free-text search query',
      required: false,
    }),
  } as const;

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<DocumentSearchResult> {
    const { args } = await this.parse(DocumentSearch);
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'SearchDocuments' | 'ListDocuments'>
    >(deps, getLinearSdk);

    // 1. Build search/qualifier terms -------------------------------------------------
    const terms: string[] = [];

    const trimmedQuery = args.query?.trim();
    if (trimmedQuery) {
      terms.push(trimmedQuery);
    }

    // Multi-value qualifiers
    normaliseMulti(parsed.team).forEach((t) => terms.push(`team:${t}`));
    normaliseMulti(parsed.project).forEach((p) => terms.push(`project:${p}`));

    // Single-value qualifiers
    if (parsed.creator?.trim()) terms.push(`creator:${parsed.creator.trim()}`);
    if (parsed.updated.length > 0) {
      let map: {
        gt?: string | undefined;
        gte?: string | undefined;
        lt?: string | undefined;
        lte?: string | undefined;
        eq?: string | undefined;
      } = {};
      try {
        const updatedVals = normaliseMulti(parsed.updated);
        map = buildDateComparatorMap(updatedVals);
      } catch (err) {
        const msg = formatDateErrorForFlag(err, 'updated');
        throw new LibValidationError(msg);
      }
      terms.push(...comparatorMapToSearchQualifiers('updated', map));
    }

    // --sort (field[:asc|desc])
    if (parsed.sort?.trim()) {
      const sortRaw = parsed.sort.trim();
      const [fieldPart, orderPart] = sortRaw.split(':', 2);
      const field = (fieldPart ?? '').trim().toLowerCase();
      const allowedFields = new Set(['created', 'updated']);
      if (!allowedFields.has(field)) {
        throw new LibValidationError(
          'Invalid --sort field. Allowed values: created, updated.'
        );
      }

      const orderRaw = orderPart?.trim();
      if (orderRaw) {
        const order = orderRaw.toLowerCase();
        const allowedOrders = new Set(['asc', 'desc']);
        if (!allowedOrders.has(order)) {
          throw new LibValidationError(
            'Invalid --sort direction. Allowed values: asc, desc.'
          );
        }
        terms.push(`sort:${field}:${order}`);
      } else {
        terms.push(`sort:${field}`);
      }
    }

    // 2. Choose the appropriate GraphQL operation -----------------------------------
    type SearchNode = SearchDocumentsQuery['searchDocuments']['nodes'][number];
    type ListNode = ListDocumentsQuery['documents']['nodes'][number];
    let nodes: (SearchNode | ListNode)[] = [];

    if (terms.length === 0) {
      nodes = await searchDocumentsOp(
        { first: parsed.limit },
        { client, cache }
      );
    } else {
      const term = terms.join(' ');
      nodes = await searchDocumentsOp(
        { term, first: parsed.limit },
        { client, cache }
      );
    }

    // 3. Render ----------------------------------------------------------------------
    if (this.jsonEnabled()) return nodes;
    this.printRows(nodes.map((doc) => documentToTsv(doc)));
    return nodes;
  }
}
