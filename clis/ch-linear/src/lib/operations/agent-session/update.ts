import {
  type AgentSessionUpdateMutation,
  type AgentSessionUpdateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type UpdateAgentSessionParams = {
  id: AgentSessionUpdateMutationVariables['id'];
  input: AgentSessionUpdateMutationVariables['input'];
};

type UpdateAgentSessionContext = {
  client: {
    AgentSessionUpdate: (
      vars: AgentSessionUpdateMutationVariables
    ) => Promise<AgentSessionUpdateMutation>;
  };
};

/**
 * Update an agent session.
 *
 * @param params.id Agent session UUID.
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentSessionUpdate`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function updateAgentSession(
  params: UpdateAgentSessionParams,
  ctx: UpdateAgentSessionContext
): Promise<NonNullable<AgentSessionUpdateMutation['agentSessionUpdate']>> {
  try {
    const resp = await ctx.client.AgentSessionUpdate({
      id: params.id,
      input: params.input,
    });
    const payload = resp.agentSessionUpdate;
    if (!payload) {
      throw new ApiRequestError('Agent session update returned no payload');
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent session update failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to update agent session', err);
  }
}
