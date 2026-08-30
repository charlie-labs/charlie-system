import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type CommentUpdateMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getErrorMessage } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { updateComment as updateCommentOp } from '../../../lib/operations/comment/update-comment.js';
import { commentToTsv } from '../../utils/comment.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';

const manifest = defineFlags({
  body: {
    oclif: Flags.string({
      char: 'b',
      description: 'New Markdown content for the comment',
    }),
    schema: z.string().trim().min(1, 'Body cannot be empty.').optional(),
  },
  'resolve-thread': {
    oclif: Flags.boolean({
      char: 'r',
      description: 'Mark the comment thread as resolved',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
} as const);

/**
 * Update the body of an existing comment and/or mark its thread as resolved.
 */
export default class CommentUpdate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'CommentUpdate'>>
  | Result<{
      comment: NonNullable<CommentUpdateMutation['commentUpdate']['comment']>;
    }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Edit an existing comment (body and/or resolve thread).',
    '',
    'Output',
    '- TSV columns (in order): id, user, updatedAt, body (first 60 chars)',
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

  static args = {
    'comment-id': Args.string({
      name: 'comment-id',
      description: 'UUID of the comment to modify',
      required: true,
    }),
  } as const;

  static examples = [
    '$ <%= config.bin %> comment update cmt_123 --body "Updated details after investigation"',
    '$ <%= config.bin %> comment update cmt_123 --resolve-thread --json',
  ];

  protected override async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    comment: NonNullable<CommentUpdateMutation['commentUpdate']['comment']>;
  }> {
    const {
      args: { 'comment-id': commentId },
    } = await this.parse(CommentUpdate);

    const { client } = resolveDeps<Pick<Sdk, 'CommentUpdate'>>(
      deps,
      getLinearSdk
    );

    // Normalize and validate inputs
    const willResolve = Boolean(parsed['resolve-thread']);
    const body =
      parsed.body !== undefined
        ? await formatForLinearString(parsed.body)
        : undefined;

    if (!willResolve && !body) {
      this.error('Provide at least --body or --resolve-thread.');
    }

    // Build params for the operation, omitting body when only resolving
    const params: {
      id: string;
      body?: string;
      resolvingCommentId?: string;
    } = {
      id: commentId,
      ...(body ? { body } : {}),
      ...(willResolve ? { resolvingCommentId: commentId } : {}),
    };

    try {
      const payload = await updateCommentOp(params, { client });
      const { comment } = payload;
      if (!comment) {
        this.error('Comment update failed – no comment returned.');
      }
      this.printRows([commentToTsv(comment, { timestamp: 'updatedAt' })]);
      // JSON mode: return a single-key wrapper { comment }
      return { comment };
    } catch (err) {
      this.error(getErrorMessage(err));
    }
  }
}
