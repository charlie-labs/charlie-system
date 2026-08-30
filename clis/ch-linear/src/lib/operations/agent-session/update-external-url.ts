import {
  type AgentSessionUpdateExternalUrlMutation,
  type AgentSessionUpdateExternalUrlMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type UpdateAgentSessionExternalUrlParams = {
  id: AgentSessionUpdateExternalUrlMutationVariables['id'];
  input: AgentSessionUpdateExternalUrlMutationVariables['input'];
};

type UpdateAgentSessionExternalUrlContext = {
  client: {
    AgentSessionUpdateExternalUrl: (
      vars: AgentSessionUpdateExternalUrlMutationVariables
    ) => Promise<AgentSessionUpdateExternalUrlMutation>;
  };
};

/**
 * Update the external URLs associated with an agent session.
 *
 * @param params.id Agent session UUID.
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentSessionUpdateExternalUrl`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function updateAgentSessionExternalUrl(
  params: UpdateAgentSessionExternalUrlParams,
  ctx: UpdateAgentSessionExternalUrlContext
): Promise<
  NonNullable<
    AgentSessionUpdateExternalUrlMutation['agentSessionUpdateExternalUrl']
  >
> {
  try {
    const resp = await ctx.client.AgentSessionUpdateExternalUrl({
      id: params.id,
      input: params.input,
    });
    const payload = resp.agentSessionUpdateExternalUrl;
    if (!payload) {
      throw new ApiRequestError(
        'Agent session external URL update returned no payload'
      );
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent session external URL update failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError(
      'Failed to update agent session external URL',
      err
    );
  }
}
