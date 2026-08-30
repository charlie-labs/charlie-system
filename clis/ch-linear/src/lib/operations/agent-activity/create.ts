import {
  type AgentActivityCreateMutation,
  type AgentActivityCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateAgentActivityParams = {
  input: AgentActivityCreateMutationVariables['input'];
};

type CreateAgentActivityContext = {
  client: {
    AgentActivityCreate: (
      vars: AgentActivityCreateMutationVariables
    ) => Promise<AgentActivityCreateMutation>;
  };
};

/**
 * Create a new agent activity within an agent session.
 *
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentActivityCreate`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function createAgentActivity(
  params: CreateAgentActivityParams,
  ctx: CreateAgentActivityContext
): Promise<NonNullable<AgentActivityCreateMutation['agentActivityCreate']>> {
  try {
    const resp = await ctx.client.AgentActivityCreate({ input: params.input });
    const payload = resp.agentActivityCreate;
    if (!payload) {
      throw new ApiRequestError('Agent activity create returned no payload');
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent activity create failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to create agent activity', err);
  }
}
