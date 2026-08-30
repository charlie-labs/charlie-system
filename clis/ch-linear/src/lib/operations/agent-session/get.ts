import {
  type GetAgentSessionQuery,
  type GetAgentSessionQueryVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type GetAgentSessionParams = {
  id: GetAgentSessionQueryVariables['id'];
};

type GetAgentSessionContext = {
  client: {
    GetAgentSession: (
      vars: GetAgentSessionQueryVariables
    ) => Promise<GetAgentSessionQuery>;
  };
};

/**
 * Fetch a single agent session by ID.
 *
 * @param params.id Agent session UUID.
 * @param ctx.client Linear SDK subset exposing `GetAgentSession`.
 * @returns The fetched agent session.
 * @throws NotFoundError When the session does not exist.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function getAgentSession(
  params: GetAgentSessionParams,
  ctx: GetAgentSessionContext
): Promise<NonNullable<GetAgentSessionQuery['agentSession']>> {
  try {
    const resp = await ctx.client.GetAgentSession({ id: params.id });
    if (!resp.agentSession) {
      throw new NotFoundError('agent session', params.id);
    }
    return resp.agentSession;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to fetch agent session', err);
  }
}
