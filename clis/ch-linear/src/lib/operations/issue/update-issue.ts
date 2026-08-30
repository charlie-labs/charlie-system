import {
  type UpdateIssueMutation,
  type UpdateIssueMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type UpdateIssueParams = {
  id: string;
  input: UpdateIssueMutationVariables['input'];
};

type UpdateIssueContext = {
  client: {
    UpdateIssue: (
      vars: UpdateIssueMutationVariables
    ) => Promise<UpdateIssueMutation>;
  };
};

/**
 * Update a Linear issue by ID.
 *
 * @param params.id The issue UUID.
 * @param params.input The mutation input payload to apply.
 * @param ctx.client Linear SDK subset exposing `UpdateIssue`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws NotFoundError When Linear returns a null payload (issue not found).
 * @throws ApiRequestError For transport/request failures.
 */
export async function updateIssue(
  params: UpdateIssueParams,
  ctx: UpdateIssueContext
): Promise<NonNullable<UpdateIssueMutation['issueUpdate']>> {
  try {
    const resp = await ctx.client.UpdateIssue({
      id: params.id,
      input: params.input,
    });
    if (!resp.issueUpdate) {
      // Null payload indicates the target issue was not found or not updated
      throw new NotFoundError('issue', params.id);
    }
    return resp.issueUpdate;
  } catch (err) {
    // Preserve domain/request errors to avoid obscuring context
    if (err instanceof NotFoundError) throw err;
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to update issue', err);
  }
}
