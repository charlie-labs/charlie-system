import {
  type DocumentCreateMutation,
  type DocumentCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateDocumentParams = {
  input: DocumentCreateMutationVariables['input'];
};

type CreateDocumentContext = {
  client: {
    DocumentCreate: (
      vars: DocumentCreateMutationVariables
    ) => Promise<DocumentCreateMutation>;
  };
};

/**
 * Create a new Linear document.
 *
 * @param params.input The mutation input payload.
 * @param ctx.client Linear SDK subset exposing `DocumentCreate`.
 * @returns The created document payload.
 * @throws ApiRequestError When the request fails or Linear returns a null payload.
 */
export async function createDocument(
  params: CreateDocumentParams,
  ctx: CreateDocumentContext
): Promise<NonNullable<DocumentCreateMutation['documentCreate']>> {
  try {
    const resp = await ctx.client.DocumentCreate({ input: params.input });
    if (!resp.documentCreate) {
      throw new ApiRequestError('Document create returned no payload');
    }
    return resp.documentCreate;
  } catch (err) {
    throw new ApiRequestError('Failed to create document', err);
  }
}
