import {
  type CreateInitiativeMutation,
  type CreateInitiativeMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateInitiativeParams = {
  input: CreateInitiativeMutationVariables['input'];
};

type CreateInitiativeContext = {
  client: {
    CreateInitiative: (
      vars: CreateInitiativeMutationVariables
    ) => Promise<CreateInitiativeMutation>;
  };
};

/**
 * Create a new Linear initiative.
 *
 * @param params.input The mutation input for initiative creation.
 * @param ctx.client Linear SDK subset exposing `CreateInitiative`.
 * @returns The created initiative payload.
 * @throws ApiRequestError When the request fails or Linear returns a null payload.
 */
export async function createInitiative(
  params: CreateInitiativeParams,
  ctx: CreateInitiativeContext
): Promise<NonNullable<CreateInitiativeMutation['initiativeCreate']>> {
  try {
    const resp = await ctx.client.CreateInitiative({ input: params.input });
    if (!resp.initiativeCreate) {
      throw new ApiRequestError('Initiative create returned no payload');
    }
    return resp.initiativeCreate;
  } catch (err) {
    if (err instanceof ApiRequestError) {
      throw err;
    }
    throw new ApiRequestError('Failed to create initiative', err);
  }
}
