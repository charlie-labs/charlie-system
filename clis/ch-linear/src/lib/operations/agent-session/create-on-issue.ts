import {
  type AgentSessionCreateOnIssueMutation,
  type AgentSessionCreateOnIssueMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateAgentSessionOnIssueParams = {
  input: AgentSessionCreateOnIssueMutationVariables['input'];
};

type CreateAgentSessionOnIssueContext = {
  client: {
    AgentSessionCreateOnIssue: (
      vars: AgentSessionCreateOnIssueMutationVariables
    ) => Promise<AgentSessionCreateOnIssueMutation>;
  };
};

/**
 * Create a new agent session on an issue.
 *
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentSessionCreateOnIssue`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function createAgentSessionOnIssue(
  params: CreateAgentSessionOnIssueParams,
  ctx: CreateAgentSessionOnIssueContext
): Promise<
  NonNullable<AgentSessionCreateOnIssueMutation['agentSessionCreateOnIssue']>
> {
  try {
    const resp = await ctx.client.AgentSessionCreateOnIssue({
      input: params.input,
    });
    const payload = resp.agentSessionCreateOnIssue;
    if (!payload) {
      throw new ApiRequestError(
        'Agent session create-on-issue returned no payload'
      );
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent session create-on-issue failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to create agent session on issue', err);
  }
}
