import {
  type AgentSessionCreateOnCommentMutation,
  type AgentSessionCreateOnCommentMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateAgentSessionOnCommentParams = {
  input: AgentSessionCreateOnCommentMutationVariables['input'];
};

type CreateAgentSessionOnCommentContext = {
  client: {
    AgentSessionCreateOnComment: (
      vars: AgentSessionCreateOnCommentMutationVariables
    ) => Promise<AgentSessionCreateOnCommentMutation>;
  };
};

/**
 * Create a new agent session on a comment.
 *
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentSessionCreateOnComment`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function createAgentSessionOnComment(
  params: CreateAgentSessionOnCommentParams,
  ctx: CreateAgentSessionOnCommentContext
): Promise<
  NonNullable<
    AgentSessionCreateOnCommentMutation['agentSessionCreateOnComment']
  >
> {
  try {
    const resp = await ctx.client.AgentSessionCreateOnComment({
      input: params.input,
    });
    const payload = resp.agentSessionCreateOnComment;
    if (!payload) {
      throw new ApiRequestError(
        'Agent session create-on-comment returned no payload'
      );
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent session create-on-comment failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to create agent session on comment', err);
  }
}
