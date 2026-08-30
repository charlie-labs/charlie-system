import {
  type CommentReactionCreateMutation,
  type CommentReactionCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { normalizeReactionEmoji } from './reaction-emoji.js';

type AddCommentReactionParams = {
  commentId: string;
  emoji: string;
};

type AddCommentReactionContext = {
  client: {
    CommentReactionCreate: (
      vars: CommentReactionCreateMutationVariables
    ) => Promise<CommentReactionCreateMutation>;
  };
};

export async function addCommentReaction(
  params: AddCommentReactionParams,
  ctx: AddCommentReactionContext
): Promise<NonNullable<CommentReactionCreateMutation['reactionCreate']>> {
  try {
    const emoji = normalizeReactionEmoji(params.emoji);
    const resp = await ctx.client.CommentReactionCreate({
      input: { commentId: params.commentId, emoji },
    });
    if (!resp.reactionCreate) {
      throw new ApiRequestError('Reaction create returned no payload');
    }
    return resp.reactionCreate;
  } catch (err) {
    throw new ApiRequestError('Failed to add reaction', err);
  }
}
