import {
  type CommentCreateMutation,
  type CommentCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateCommentParams = {
  input: CommentCreateMutationVariables['input'];
};

type CreateCommentContext = {
  client: {
    CommentCreate: (
      vars: CommentCreateMutationVariables
    ) => Promise<CommentCreateMutation>;
  };
};

export async function createComment(
  params: CreateCommentParams,
  ctx: CreateCommentContext
): Promise<NonNullable<CommentCreateMutation['commentCreate']>> {
  try {
    const resp = await ctx.client.CommentCreate({ input: params.input });
    if (!resp.commentCreate) {
      throw new ApiRequestError('Comment create returned no payload');
    }
    return resp.commentCreate;
  } catch (err) {
    throw new ApiRequestError('Failed to create comment', err);
  }
}
