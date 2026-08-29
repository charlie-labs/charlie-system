import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  zPositiveInt,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type GetCommentsQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getErrorMessage } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listComments } from '../../../lib/operations/comment/list-comments.js';
import { resolveIssueId } from '../../utils/resolvers/index.js';

const manifest = defineFlags({
  limit: {
    oclif: Flags.integer({
      char: 'l',
      description: 'Maximum number of comments to return',
      default: 30,
      min: 1,
    }),
    schema: zPositiveInt({ default: 30 }),
  },
  after: {
    oclif: Flags.string({
      char: 'a',
      description: 'Pagination cursor to start after',
    }),
    schema: z
      .string()
      .trim()
      .min(1, 'Cursor must include at least one character.')
      .optional(),
  },
} as const);

export default class CommentList extends BaseCommand<
  CfgFlags<typeof manifest> | Deps<LinearDeps<'GetComments'>>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'List comments for a given Linear issue.',
    '',
    'Use `--after <cursor>` to resume pagination from a specific comment cursor returned by Linear.',
    '',
    'Output',
    '- TSV columns (in order): id, user, timestamp, body (first 60 chars)',
    '- JSON shape:',
    '```ts',
    'type Comment = {',
    '  id: uuid;',
    '  body: string;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '  user: { displayName: string | null; name: string | null } | null;',
    '};',
    '// Output: Comment[]',
    '```',
  ].join('\n');

  static args = {
    'issue-id': Args.string({
      name: 'issue-id',
      description: 'Issue identifier or UUID whose comments are fetched',
      required: true,
    }),
  } as const;

  static examples = [
    '$ <%= config.bin %> comment list ENG-123',
    '$ <%= config.bin %> comment list ENG-123 --limit 5 --json',
    '$ <%= config.bin %> comment list ENG-123 --after <cursor> --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<GetCommentsQuery['comments']['nodes']> {
    const {
      args: { 'issue-id': issueIdRaw },
    } = await this.parse(CommentList);

    let issueId: string | undefined;
    try {
      issueId = await resolveIssueId(issueIdRaw);
    } catch (err) {
      this.error(getErrorMessage(err));
    }

    const resolvedIssueId =
      issueId ?? this.error(`Unable to resolve issue "${issueIdRaw}".`);

    const { client, cache } = resolveDeps<Pick<Sdk, 'GetComments'>>(
      deps,
      getLinearSdk
    );

    const comments = await listComments(
      { issueId: resolvedIssueId, limit: parsed.limit, after: parsed.after },
      { client, cache }
    );

    this.printRows(
      comments.map((c) => {
        const userName = c.user?.displayName ?? c.user?.name ?? '';
        const tsRaw = c.createdAt ?? c.updatedAt ?? '';
        const ts = tsRaw ? new Date(tsRaw).toISOString() : '';
        const snippet = c.body.replace(/\s+/g, ' ').slice(0, 60);
        return [c.id, userName, ts, snippet];
      }),
      { header: ['id', 'user', 'timestamp', 'body'] }
    );

    return comments;
  }
}
