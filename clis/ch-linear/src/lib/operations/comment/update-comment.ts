import {
  type CommentUpdateMutation,
  type CommentUpdateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type UpdateCommentParams = {
  id: string;
  /**
   * Optional new Markdown body for the comment. When omitted the body is left unchanged.
   */
  body?: string;
  /**
   * When provided, marks the thread as resolved by setting the resolving comment.
   * Linear's API expects the child comment ID that resolves the thread.
   */
  resolvingCommentId?: string;
};

type UpdateCommentContext = {
  client: {
    CommentUpdate: (
      vars: CommentUpdateMutationVariables
    ) => Promise<CommentUpdateMutation>;
  };
};

export async function updateComment(
  params: UpdateCommentParams,
  ctx: UpdateCommentContext
): Promise<NonNullable<CommentUpdateMutation['commentUpdate']>> {
  try {
    const input: CommentUpdateMutationVariables['input'] = {
      ...(params.body !== undefined ? { body: params.body } : {}),
      ...(params.resolvingCommentId
        ? { resolvingCommentId: params.resolvingCommentId }
        : {}),
    };
    // Fail fast if nothing to update. This guards the API from accidental
    // empty updates when callers forget to include fields.
    if (Object.keys(input).length === 0) {
      throw new ApiRequestError('No update fields provided for comment update');
    }
    const resp = await ctx.client.CommentUpdate({ id: params.id, input });
    if (!resp.commentUpdate) {
      throw new ApiRequestError('Comment update returned no payload');
    }
    return resp.commentUpdate;
  } catch (err) {
    throw new ApiRequestError('Failed to update comment', err);
  }
}
