import {
  type CustomerNeedCreateMutation,
  type CustomerNeedCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateCustomerNeedParams = {
  input: CustomerNeedCreateMutationVariables['input'];
};

type CreateCustomerNeedContext = {
  client: {
    CustomerNeedCreate: (
      vars: CustomerNeedCreateMutationVariables
    ) => Promise<CustomerNeedCreateMutation>;
  };
};

export async function createCustomerNeed(
  params: CreateCustomerNeedParams,
  ctx: CreateCustomerNeedContext
): Promise<NonNullable<CustomerNeedCreateMutation['customerNeedCreate']>> {
  try {
    const resp = await ctx.client.CustomerNeedCreate({ input: params.input });
    if (!resp.customerNeedCreate) {
      throw new ApiRequestError('Customer need create returned no payload');
    }
    return resp.customerNeedCreate;
  } catch (err) {
    throw new ApiRequestError('Failed to create customer need', err);
  }
}
