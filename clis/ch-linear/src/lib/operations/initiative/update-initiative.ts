import {
  type UpdateInitiativeMutation,
  type UpdateInitiativeMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type UpdateInitiativeParams = {
  id: string;
  input: UpdateInitiativeMutationVariables['input'];
};

type UpdateInitiativeContext = {
  client: {
    UpdateInitiative: (
      vars: UpdateInitiativeMutationVariables
    ) => Promise<UpdateInitiativeMutation>;
  };
};

/**
 * Update a Linear initiative by ID.
 *
 * @param params.id The initiative UUID.
 * @param params.input The mutation input payload.
 * @param ctx.client Linear SDK subset exposing `UpdateInitiative`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws NotFoundError When Linear returns a null payload (initiative missing).
 * @throws ApiRequestError For network/transport or other request failures.
 */
export async function updateInitiative(
  params: UpdateInitiativeParams,
  ctx: UpdateInitiativeContext
): Promise<NonNullable<UpdateInitiativeMutation['initiativeUpdate']>> {
  try {
    const resp = await ctx.client.UpdateInitiative({
      id: params.id,
      input: params.input,
    });
    if (!resp.initiativeUpdate) {
      throw new NotFoundError('initiative', params.id);
    }
    return resp.initiativeUpdate;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError('Failed to update initiative', err);
  }
}
