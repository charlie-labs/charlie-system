import {
  type DocumentUpdateMutation,
  type DocumentUpdateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type UpdateDocumentParams = {
  id: string;
  input: DocumentUpdateMutationVariables['input'];
};

type UpdateDocumentContext = {
  client: {
    DocumentUpdate: (
      vars: DocumentUpdateMutationVariables
    ) => Promise<DocumentUpdateMutation>;
  };
};

/**
 * Update a Linear document by ID.
 *
 * @param params.id The document's UUID.
 * @param params.input The mutation input describing the update.
 * @param ctx.client Linear SDK subset exposing `DocumentUpdate`.
 * @returns The non-null mutation payload returned by Linear.
 * @throws NotFoundError When Linear returns a null `documentUpdate` payload (document not found).
 * @throws ApiRequestError For transport or other request failures.
 */
export async function updateDocument(
  params: UpdateDocumentParams,
  ctx: UpdateDocumentContext
): Promise<NonNullable<DocumentUpdateMutation['documentUpdate']>> {
  try {
    const resp = await ctx.client.DocumentUpdate({
      id: params.id,
      input: params.input,
    });
    if (!resp.documentUpdate) {
      throw new NotFoundError('document', params.id);
    }
    return resp.documentUpdate;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to update document', err);
  }
}
