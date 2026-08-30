import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import { type Sdk } from '../../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../../lib/deps.js';
import { getErrorMessage } from '../../../../lib/errors/index.js';
import { getLinearSdk } from '../../../../lib/linear/linear-sdk.js';
import { normalizeReactionEmoji } from '../../../../lib/operations/comment/reaction-emoji.js';
import { removeCommentReaction } from '../../../../lib/operations/comment/remove-reaction.js';

export default class CommentReactionRemove extends BaseCommand<
  | Deps<LinearDeps<'GetCommentReactions' | 'CommentReactionDelete'>>
  | Result<{ removed: boolean }>
> {
  static description = [
    'Remove one of your reactions from a comment.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type RemoveReactionResult = { removed: boolean };',
    '// Output: RemoveReactionResult',
    '```',
  ].join('\n');

  static args = {
    'comment-id': Args.string({
      name: 'comment-id',
      description: 'UUID of the comment',
      required: true,
    }),
    reaction: Args.string({
      name: 'reaction',
      description: 'Emoji or shortcode to remove',
      required: true,
    }),
  } as const;

  static examples = [
    '$ <%= config.bin %> comment reaction remove cmt_123 👍',
    '$ <%= config.bin %> comment reaction remove cmt_123 :rocket: --json',
  ];

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<{ removed: boolean }> {
    const {
      args: { 'comment-id': commentId, reaction },
    } = await this.parse(CommentReactionRemove);

    const { client } = resolveDeps<
      Pick<Sdk, 'GetCommentReactions' | 'CommentReactionDelete'>
    >(deps, getLinearSdk);

    const normalizedReaction = normalizeReactionEmoji(reaction);

    try {
      const result = await removeCommentReaction(
        { commentId, emoji: reaction },
        { client }
      );

      if (result.removed) {
        this.logInfo(
          `✓ Removed reaction "${normalizedReaction}" from comment ${commentId}`
        );
      } else {
        this.logWarn(
          `Reaction "${normalizedReaction}" not found on comment ${commentId} – no change.`
        );
      }
      return result;
    } catch (err) {
      this.error(getErrorMessage(err));
    }
  }
}
