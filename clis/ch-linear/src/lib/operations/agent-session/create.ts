import {
  type AgentSessionCreateMutation,
  type AgentSessionCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateAgentSessionParams = {
  input: AgentSessionCreateMutationVariables['input'];
};

type CreateAgentSessionContext = {
  client: {
    AgentSessionCreate: (
      vars: AgentSessionCreateMutationVariables
    ) => Promise<AgentSessionCreateMutation>;
  };
};

/**
 * Create a new generic agent session.
 *
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentSessionCreate`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function createAgentSession(
  params: CreateAgentSessionParams,
  ctx: CreateAgentSessionContext
): Promise<NonNullable<AgentSessionCreateMutation['agentSessionCreate']>> {
  try {
    const resp = await ctx.client.AgentSessionCreate({ input: params.input });
    const payload = resp.agentSessionCreate;
    if (!payload) {
      throw new ApiRequestError('Agent session create returned no payload');
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent session create failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to create agent session', err);
  }
}
