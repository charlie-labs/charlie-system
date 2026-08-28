import { CliError } from './errors.js';

export type JsonRecord = { readonly [key: string]: unknown };

export function formatHttpFailure(
  status: number,
  statusText: string,
  body: string
): string {
  const statusLabel = statusText ? `${status} ${statusText}` : String(status);
  const detail = body.trim().slice(0, 1000);
  return detail ? `HTTP ${statusLabel}: ${detail}` : `HTTP ${statusLabel}`;
}

export function parseJsonRpcMessage(body: string): JsonRecord {
  const candidates = extractSseData(body);
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Try the next SSE data event before reporting a malformed response.
    }
  }
  throw new CliError('MCP response was not valid SSE or JSON-RPC JSON.');
}

function extractSseData(body: string): string[] {
  const dataLines = body
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).replace(/^ /u, ''))
    .filter((line) => line.length > 0 && line !== '[DONE]');

  return dataLines.length > 0 ? dataLines : [body.trim()];
}

export function extractContentText(result: JsonRecord): string {
  if (!Array.isArray(result.content)) {
    throw new CliError('MCP result did not contain text content.');
  }

  const text = result.content
    .filter(isTextContent)
    .map((item) => item.text)
    .join('\n');
  if (!text) {
    throw new CliError('MCP result did not contain text content.');
  }
  return text;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextContent(
  value: unknown
): value is { readonly type: 'text'; readonly text: string } {
  return (
    isRecord(value) && value.type === 'text' && typeof value.text === 'string'
  );
}
