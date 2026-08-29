import { getErrorMessage } from '@charlie-labs/oclif-plugin-helpers';

import type { DocsDeps } from './contracts.js';
import { DocsOperationalError } from './errors.js';

export function formatHttpFailure(
  status: number,
  statusText: string,
  body: string
): string {
  const statusLabel = statusText ? `${status} ${statusText}` : String(status);
  const detail = body.trim().slice(0, 1000);
  return detail ? `HTTP ${statusLabel}: ${detail}` : `HTTP ${statusLabel}`;
}

export async function fetchText(
  input: string,
  headers: Readonly<Record<string, string>>,
  deps: DocsDeps
): Promise<string> {
  let response: Response;
  try {
    response = await deps.fetch(input, { headers });
  } catch (error) {
    throw new DocsOperationalError(getErrorMessage(error), error);
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw new DocsOperationalError(getErrorMessage(error), error);
  }
  if (!response.ok) {
    throw new DocsOperationalError(
      formatHttpFailure(response.status, response.statusText, body)
    );
  }
  return body;
}
