import { type AgentSessionUpdateMutation } from '../../../generated/linear-sdk.js';
import { updateAgentSession } from './update.js';

type UpdateAgentSessionParams = Parameters<typeof updateAgentSession>[0];
type UpdateAgentSessionContext = Parameters<typeof updateAgentSession>[1];

/**
 * Update an agent session's plan JSON.
 *
 * @param params.id Agent session UUID.
 * @param params.plan Plan JSON value to set.
 * @param ctx Execution context passed through to {@link updateAgentSession}.
 * @returns The non-null mutation payload returned by Linear.
 */
export async function setAgentSessionPlan(
  params: {
    id: UpdateAgentSessionParams['id'];
    plan: UpdateAgentSessionParams['input']['plan'];
  },
  ctx: UpdateAgentSessionContext
): Promise<NonNullable<AgentSessionUpdateMutation['agentSessionUpdate']>> {
  return updateAgentSession(
    {
      id: params.id,
      input: { plan: params.plan },
    },
    ctx
  );
}
