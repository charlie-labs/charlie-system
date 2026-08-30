import {
  type GetAgentActivitiesQuery,
  type GetAgentActivitiesQueryVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type ListAgentActivitiesParams = {
  filter?: GetAgentActivitiesQueryVariables['filter'];
  first?: GetAgentActivitiesQueryVariables['first'];
  after?: GetAgentActivitiesQueryVariables['after'];
};

type ListAgentActivitiesContext = {
  client: {
    GetAgentActivities: (
      vars: GetAgentActivitiesQueryVariables
    ) => Promise<GetAgentActivitiesQuery>;
  };
};

/**
 * List agent activities.
 *
 * @param params.filter Optional query filter (for example, filter by agentSessionId).
 * @param params.first Optional page size.
 * @param params.after Optional pagination cursor.
 * @param ctx.client Linear SDK subset exposing `GetAgentActivities`.
 * @returns A Linear agent activity connection.
 * @throws ApiRequestError When the underlying request fails.
 */
export async function listAgentActivities(
  params: ListAgentActivitiesParams,
  ctx: ListAgentActivitiesContext
): Promise<NonNullable<GetAgentActivitiesQuery['agentActivities']>> {
  try {
    const resp = await ctx.client.GetAgentActivities({
      ...(params.filter !== undefined ? { filter: params.filter } : {}),
      ...(params.first !== undefined ? { first: params.first } : {}),
      ...(params.after !== undefined ? { after: params.after } : {}),
    });

    if (!resp.agentActivities) {
      throw new ApiRequestError('Agent activities list returned no payload');
    }
    return resp.agentActivities;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to list agent activities', err);
  }
}
