import { getErrorMessage } from '@charlie-labs/oclif-plugin-helpers';

import {
  FEEDBACK_TOOL,
  FILESYSTEM_TOOL,
  MCP_PROTOCOL_VERSION,
  MCP_URL,
  SEARCH_TOOL,
} from './config.js';
import type { DocsDeps, JsonRecord } from './contracts.js';
import { DocsOperationalError } from './errors.js';
import { formatHttpFailure } from './http.js';

export type McpToolName =
  | typeof FEEDBACK_TOOL
  | typeof FILESYSTEM_TOOL
  | typeof SEARCH_TOOL;

export async function callMcp(
  toolName: McpToolName,
  arguments_: JsonRecord,
  deps: DocsDeps
): Promise<JsonRecord> {
  let response: Response;
  try {
    response = await deps.fetch(MCP_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: arguments_ },
      }),
    });
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

  const message = parseJsonRpcMessage(body);
  if (isRecord(message.error)) {
    const code =
      typeof message.error.code === 'number' ? ` (${message.error.code})` : '';
    const detail =
      typeof message.error.message === 'string'
        ? message.error.message
        : 'unknown JSON-RPC error';
    throw new DocsOperationalError(`MCP JSON-RPC error${code}: ${detail}`);
  }

  if (!isRecord(message.result)) {
    throw new DocsOperationalError(
      'MCP response did not contain a JSON-RPC result.'
    );
  }
  if (message.result.isError === true) {
    throw new DocsOperationalError(
      `MCP tool '${toolName}' failed: ${extractContentText(message.result)}`
    );
  }
  return message.result;
}

function parseJsonRpcMessage(body: string): JsonRecord {
  const candidates = extractSseData(body);
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Try the next SSE data event before reporting a malformed response.
    }
  }
  throw new DocsOperationalError(
    'MCP response was not valid SSE or JSON-RPC JSON.'
  );
}

export function extractContentText(result: JsonRecord): string {
  if (!Array.isArray(result.content)) {
    throw new DocsOperationalError('MCP result did not contain text content.');
  }

  const text = result.content
    .filter(isTextContent)
    .map((item) => item.text)
    .join('\n');
  if (!text) {
    throw new DocsOperationalError('MCP result did not contain text content.');
  }
  return text;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractSseData(body: string): readonly string[] {
  const dataLines = body
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).replace(/^ /u, ''))
    .filter((line) => line.length > 0 && line !== '[DONE]');

  return dataLines.length > 0 ? dataLines : [body.trim()];
}

function isTextContent(
  value: unknown
): value is { readonly type: 'text'; readonly text: string } {
  return (
    isRecord(value) && value.type === 'text' && typeof value.text === 'string'
  );
}
