import {
  type CreateIssueMutation,
  type CreateIssueMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateIssueParams = {
  input: CreateIssueMutationVariables['input'];
};

type CreateIssueContext = {
  client: {
    CreateIssue: (
      vars: CreateIssueMutationVariables
    ) => Promise<CreateIssueMutation>;
  };
};

/**
 * Create a new Linear issue.
 *
 * @param params.input The mutation input payload (title, teamId, etc.).
 * @param ctx.client Linear SDK subset exposing `CreateIssue`.
 * @returns The created issue payload returned by Linear.
 * @throws ApiRequestError When the request fails or Linear returns a null payload.
 */
export async function createIssue(
  params: CreateIssueParams,
  ctx: CreateIssueContext
): Promise<NonNullable<CreateIssueMutation['issueCreate']>> {
  try {
    const resp = await ctx.client.CreateIssue({ input: params.input });
    if (!resp.issueCreate) {
      throw new ApiRequestError('Issue create returned no payload');
    }
    return resp.issueCreate;
  } catch (err) {
    if (err instanceof ApiRequestError) {
      throw err;
    }
    throw new ApiRequestError('Failed to create issue', err);
  }
}
