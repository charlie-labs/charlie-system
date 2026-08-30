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
  type CommentCreateMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getErrorMessage } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createComment as createCommentOp } from '../../../lib/operations/comment/create-comment.js';
import { commentToTsv } from '../../utils/comment.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { resolveIssueId } from '../../utils/resolvers/index.js';

const manifest = defineFlags({
  'issue-id': {
    oclif: Flags.string({
      char: 'i',
      description: 'Issue identifier or UUID that this comment belongs to',
      required: true,
    }),
    schema: z.string().trim().min(1, 'Issue ID is required'),
  },
  body: {
    oclif: Flags.string({
      char: 'b',
      description: 'Markdown body of the comment',
      required: true,
    }),
    schema: z.string().trim().min(1, 'Comment body cannot be empty.'),
  },
  'parent-id': {
    oclif: Flags.string({
      char: 'p',
      description: 'Optional parent comment ID to reply in a thread',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

/**
 * Add a new comment to an issue (optionally as a reply in a thread).
 *
 * Default (non-JSON) output prints one TSV line:
 *   <comment-id>\t<user>\t<created-at ISO>\t<body snippet>
 */
export default class CommentCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'CommentCreate'>>
  | Result<{
      comment: NonNullable<CommentCreateMutation['commentCreate']['comment']>;
    }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Create a new comment on an issue.',
    '',
    'Output',
    '- TSV columns (in order): id, user, createdAt, body (first 60 chars)',
    '- JSON shape:',
    '```ts',
    'type Comment = {',
    '  id: uuid;',
    '  body: string;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '  user: { displayName: string | null; name: string | null } | null;',
    '};',
    '// Output: { comment: Comment }',
    '```',
  ].join('\n');

  static examples = [
    // Create a comment on an issue (body + issue identifier)
    '$ <%= config.bin %> comment create --issue-id ENG-123 --body "Investigating now"',
    // Create a threaded reply and output raw JSON
    '$ <%= config.bin %> comment create --issue-id ENG-123 --body "Stack trace attached" --parent-id cmt_abc123 --json',
  ];

  protected override async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    comment: NonNullable<CommentCreateMutation['commentCreate']['comment']>;
  }> {
    const { client } = resolveDeps<Pick<Sdk, 'CommentCreate'>>(
      deps,
      getLinearSdk
    );

    const issueIdInput = parsed['issue-id'];
    const body = await formatForLinearString(parsed.body);
    const parentId = parsed['parent-id'];

    // Resolve the issue ID (identifier → UUID) when necessary
    let issueId: string | undefined;
    try {
      issueId = await resolveIssueId(issueIdInput);
    } catch (err) {
      this.error(getErrorMessage(err));
    }

    if (!issueId) {
      this.error(`Unable to resolve issue "${issueIdInput}".`);
    }

    const input: { issueId: string; parentId?: string; body: string } = {
      issueId,
      body,
      ...(parentId ? { parentId } : {}),
    };

    try {
      const payload = await createCommentOp({ input }, { client });
      const comment = payload.comment;
      if (!comment) {
        this.error('Unexpected empty comment returned from Linear.');
      }
      this.printRows([commentToTsv(comment)]);
      // JSON mode: return a single-key wrapper { comment }
      return { comment };
    } catch (err) {
      this.error(getErrorMessage(err));
    }
  }
}
