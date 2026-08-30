import {
  type CustomerCreateMutation,
  type CustomerCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateCustomerParams = {
  input: CustomerCreateMutationVariables['input'];
};

type CreateCustomerContext = {
  client: {
    CustomerCreate: (
      vars: CustomerCreateMutationVariables
    ) => Promise<CustomerCreateMutation>;
  };
};

export async function createCustomer(
  params: CreateCustomerParams,
  ctx: CreateCustomerContext
): Promise<NonNullable<CustomerCreateMutation['customerCreate']>> {
  try {
    const resp = await ctx.client.CustomerCreate({ input: params.input });
    if (!resp.customerCreate) {
      throw new ApiRequestError('Customer create returned no payload');
    }
    return resp.customerCreate;
  } catch (err) {
    throw new ApiRequestError('Failed to create customer', err);
  }
}
