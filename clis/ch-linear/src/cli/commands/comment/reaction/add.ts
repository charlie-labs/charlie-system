import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import {
  type CommentReactionCreateMutation,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../../lib/deps.js';
import { getErrorMessage } from '../../../../lib/errors/index.js';
import { getLinearSdk } from '../../../../lib/linear/linear-sdk.js';
import { addCommentReaction } from '../../../../lib/operations/comment/add-reaction.js';

export default class CommentReactionAdd extends BaseCommand<
  | Deps<LinearDeps<'CommentReactionCreate'>>
  | Result<{
      reaction:
        | CommentReactionCreateMutation['reactionCreate']['reaction']
        | null;
      added: boolean;
    }>
> {
  static description = [
    'Add a reaction (emoji) to a comment.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type Reaction = {',
    '  id: uuid;',
    '  emoji: string;',
    '  user: { id: uuid; name: string | null; displayName: string | null } | null;',
    '};',
    'type AddReactionResult = { reaction: Reaction | null; added: boolean };',
    '// Output: AddReactionResult',
    '```',
  ].join('\n');

  static args = {
    'comment-id': Args.string({
      name: 'comment-id',
      description: 'UUID of the comment to react to',
      required: true,
    }),
    reaction: Args.string({
      name: 'reaction',
      description: 'Emoji or Linear-supported reaction shortcode',
      required: true,
    }),
  } as const;

  static examples = [
    '$ <%= config.bin %> comment reaction add cmt_123 👍',
    '$ <%= config.bin %> comment reaction add cmt_123 :rocket: --json',
  ];

  protected override async execute({ deps }: ExecCtxOf<this>): Promise<{
    reaction:
      | CommentReactionCreateMutation['reactionCreate']['reaction']
      | null;
    added: boolean;
  }> {
    const {
      args: { 'comment-id': commentId, reaction },
    } = await this.parse(CommentReactionAdd);

    const { client } = resolveDeps<Pick<Sdk, 'CommentReactionCreate'>>(
      deps,
      getLinearSdk
    );

    try {
      const payload = await addCommentReaction(
        { commentId, emoji: reaction },
        { client }
      );
      if (payload.success) {
        this.logInfo(`✓ Added reaction "${reaction}" to comment ${commentId}`);
      } else {
        this.logWarn(
          `Reaction "${reaction}" already exists on comment ${commentId} – no change.`
        );
      }
      return {
        reaction: payload.reaction ?? null,
        added: Boolean(payload.success),
      };
    } catch (err) {
      // Many duplicate-reaction attempts fail with a 400 – treat as idempotent
      const message = getErrorMessage(err);
      if (/already exists/i.test(message)) {
        this.logWarn(
          `Reaction "${reaction}" already exists on comment ${commentId} – no change.`
        );
        return { reaction: null, added: false };
      }
      this.error(message);
    }
  }
}
