import {
  type AgentActivityCreatePromptMutation,
  type AgentActivityCreatePromptMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateAgentActivityPromptParams = {
  input: AgentActivityCreatePromptMutationVariables['input'];
};

type CreateAgentActivityPromptContext = {
  client: {
    AgentActivityCreatePrompt: (
      vars: AgentActivityCreatePromptMutationVariables
    ) => Promise<AgentActivityCreatePromptMutation>;
  };
};

/**
 * Create a prompt activity within an agent session.
 *
 * @param params.input Mutation input payload.
 * @param ctx.client Linear SDK subset exposing `AgentActivityCreatePrompt`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function createAgentActivityPrompt(
  params: CreateAgentActivityPromptParams,
  ctx: CreateAgentActivityPromptContext
): Promise<
  NonNullable<AgentActivityCreatePromptMutation['agentActivityCreatePrompt']>
> {
  try {
    const resp = await ctx.client.AgentActivityCreatePrompt({
      input: params.input,
    });
    const payload = resp.agentActivityCreatePrompt;
    if (!payload) {
      throw new ApiRequestError(
        'Agent activity create-prompt returned no payload'
      );
    }
    if (!payload.success) {
      throw new ApiRequestError('Agent activity create-prompt failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to create agent activity prompt', err);
  }
}
