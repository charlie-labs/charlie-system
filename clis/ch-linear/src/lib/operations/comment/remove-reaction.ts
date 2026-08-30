import {
  type CommentReactionDeleteMutation,
  type CommentReactionDeleteMutationVariables,
  type GetCommentReactionsQuery,
  type GetCommentReactionsQueryVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { normalizeReactionEmoji } from './reaction-emoji.js';

type RemoveCommentReactionParams = {
  commentId: string;
  emoji: string;
};

type RemoveCommentReactionContext = {
  client: {
    GetCommentReactions: (
      vars: GetCommentReactionsQueryVariables
    ) => Promise<GetCommentReactionsQuery>;
    CommentReactionDelete: (
      vars: CommentReactionDeleteMutationVariables
    ) => Promise<CommentReactionDeleteMutation>;
  };
};

type RemoveCommentReactionResult = {
  removed: boolean;
};

type CommentReaction = NonNullable<
  NonNullable<GetCommentReactionsQuery['comment']>['reactions']
>[number];

export async function removeCommentReaction(
  params: RemoveCommentReactionParams,
  ctx: RemoveCommentReactionContext
): Promise<RemoveCommentReactionResult> {
  const emoji = normalizeReactionEmoji(params.emoji);

  let lookup: GetCommentReactionsQuery;
  try {
    lookup = await ctx.client.GetCommentReactions({ id: params.commentId });
  } catch (err) {
    throw new ApiRequestError('Failed to look up comment reactions', err);
  }

  const viewerId = lookup.viewer.id;
  const reaction = findViewerReaction({
    reactions: lookup.comment?.reactions ?? [],
    emoji,
    viewerId,
  });

  if (!reaction) {
    return { removed: false };
  }

  try {
    const resp = await ctx.client.CommentReactionDelete({ id: reaction.id });
    if (!resp.reactionDelete) {
      throw new ApiRequestError('Reaction delete returned no payload');
    }
    return { removed: Boolean(resp.reactionDelete.success) };
  } catch (err) {
    if (isMissingReactionDeleteError(err)) {
      return { removed: false };
    }
    if (err instanceof ApiRequestError) {
      throw err;
    }
    throw new ApiRequestError('Failed to remove reaction', err);
  }
}

function findViewerReaction({
  reactions,
  emoji,
  viewerId,
}: {
  reactions: readonly CommentReaction[];
  emoji: string;
  viewerId: string;
}): CommentReaction | undefined {
  return reactions.find(
    (reaction) => reaction.emoji === emoji && reaction.user?.id === viewerId
  );
}

function isMissingReactionDeleteError(err: unknown): boolean {
  if (!isRecord(err) || !isRecord(err['response'])) {
    return false;
  }

  const errors = err['response']['errors'];
  return (
    Array.isArray(errors) &&
    errors.length > 0 &&
    errors.every(isMissingReactionGraphQLError)
  );
}

function isMissingReactionGraphQLError(err: unknown): boolean {
  if (!isRecord(err)) {
    return false;
  }

  const path = err['path'];
  if (
    !Array.isArray(path) ||
    path.length !== 1 ||
    path[0] !== 'reactionDelete'
  ) {
    return false;
  }

  if (err['message'] !== 'Entity not found: Reaction') {
    return false;
  }

  const extensions = err['extensions'];
  if (!isRecord(extensions)) {
    return true;
  }

  const code = extensions['code'];
  const type = extensions['type'];
  if (code === undefined && type === undefined) {
    return true;
  }

  return code === 'INPUT_ERROR' && type === 'invalid input';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
