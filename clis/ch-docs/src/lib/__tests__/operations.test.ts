import { describe, expect, test } from 'bun:test';

import { FEEDBACK_TOOL, MCP_URL, SEARCH_TOOL } from '../config.js';
import type { FetchLike } from '../contracts.js';
import { DocsInvocationError, DocsOperationalError } from '../errors.js';
import { callMcp, extractContentText } from '../mcp.js';
import {
  readFilesystem,
  readFull,
  readIndex,
  readPage,
  search,
} from '../operations.js';

type FetchCall = Readonly<{
  readonly init: RequestInit | undefined;
  readonly input: RequestInfo | URL;
}>;

describe('plain documentation retrieval', () => {
  test('uses exact page, index, and full URLs and headers', async () => {
    const { fetch, calls } = mockFetch(
      new Response('content', { statusText: 'OK' })
    );

    expect((await readPage('/guides/tasks', { fetch })).content).toBe(
      'content'
    );
    expect((await readIndex({ fetch })).content).toBe('content');
    expect((await readFull({ fetch })).content).toBe('content');
    expect(calls.map((call) => call.input)).toEqual([
      'https://charlie-v3.mintlify.site/guides/tasks',
      'https://charlie-v3.mintlify.site/llms.txt',
      'https://charlie-v3.mintlify.site/llms-full.txt',
    ]);
    expect(calls.map((call) => call.init?.headers)).toEqual([
      { Accept: 'text/markdown' },
      { Accept: 'text/plain' },
      { Accept: 'text/plain' },
    ]);
  });

  test('rejects invalid page URLs before making a request', async () => {
    const { fetch, calls } = mockFetch(new Response('unexpected'));
    const invalidValues = [
      'http://charlie-v3.mintlify.site/guides/tasks',
      'https://example.com/guides/tasks',
      'https://user:password@charlie-v3.mintlify.site/guides/tasks',
      'https://charlie-v3.mintlify.site/guides/tasks?source=sidebar',
      'https://charlie-v3.mintlify.site/guides/tasks#heading',
    ];

    await Promise.all(
      invalidValues.map((value) =>
        awaitRejected(readPage(value, { fetch }), DocsInvocationError)
      )
    );
    expect(calls).toHaveLength(0);
  });

  test('preserves bounded HTTP failure details', async () => {
    const detail = 'x'.repeat(1_100);
    const { fetch } = mockFetch(new Response(`  ${detail}  `, { status: 503 }));
    const error = await rejection(readIndex({ fetch }));

    expect(error).toBeInstanceOf(DocsOperationalError);
    expect(error.message).toBe(`HTTP 503: ${'x'.repeat(1_000)}`);
  });
});

describe('MCP search retrieval', () => {
  test('preserves exact search payload and shell-sensitive text', async () => {
    const { fetch, calls } = mockFetch(
      mcpResponse({ content: [{ type: 'text', text: 'search result' }] })
    );
    const query = 'quotes " && $HOME; $(echo unsafe)';

    expect((await search(query, { fetch })).content).toBe('search result');
    expect(calls[0]?.input).toBe(MCP_URL);
    expect(calls[0]?.init?.headers).toEqual(mcpHeaders());
    expect(JSON.parse(requestBody(calls[0]?.init))).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: SEARCH_TOOL, arguments: { query } },
    });
  });
});

describe('MCP response parsing', () => {
  test('parses plain JSON-RPC and joins text blocks', async () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [
          { type: 'text', text: 'first' },
          { type: 'image', data: 'ignored' },
          { type: 'text', text: 'second' },
        ],
      },
    });
    const { fetch } = mockFetch(new Response(body));

    expect((await search('plain JSON', { fetch })).content).toBe(
      'first\nsecond'
    );
    expect(
      extractContentText({ content: [{ type: 'text', text: 'one' }] })
    ).toBe('one');
  });
});

describe('filesystem retrieval', () => {
  test('preserves filesystem commands and extracts stdout exactly', async () => {
    const { fetch, calls } = mockFetch(
      mcpResponse({
        content: [
          {
            type: 'text',
            text: 'exit: 0\n--- stdout ---\n/path/page.mdx:1: docs & details\n--- stderr ---\n',
          },
        ],
      })
    );
    const command = "rg -n 'docs & details' /";

    expect((await readFilesystem(command, { fetch })).content).toBe(
      '/path/page.mdx:1: docs & details\n'
    );
    expect(JSON.parse(requestBody(calls[0]?.init))).toMatchObject({
      params: {
        name: 'query_docs_filesystem_charlie_labs',
        arguments: { command },
      },
    });
  });
});

describe('filesystem failures', () => {
  test('fails nonzero remote filesystem commands with stderr detail', async () => {
    const { fetch } = mockFetch(
      mcpResponse({
        content: [
          {
            type: 'text',
            text: 'exit: 2\n--- stdout ---\n\n--- stderr ---\ncommand failed\n',
          },
        ],
      })
    );

    const error = await rejection(
      readFilesystem('cat /missing.mdx', { fetch })
    );
    expect(error.message).toBe(
      'remote filesystem command failed with exit 2: command failed'
    );
  });
});

describe('MCP protocol failures', () => {
  test('surfaces JSON-RPC, MCP tool, and malformed response failures', async () => {
    const jsonRpcError = await rejection(
      callMcp(
        SEARCH_TOOL,
        { query: 'bad' },
        {
          fetch: withResponse(
            jsonRpcResponse({
              error: { code: -32602, message: 'invalid query' },
            })
          ),
        }
      )
    );
    expect(jsonRpcError.message).toBe(
      'MCP JSON-RPC error (-32602): invalid query'
    );

    const toolError = await rejection(
      callMcp(
        FEEDBACK_TOOL,
        { path: '/guides/tasks', feedback: 'bad' },
        {
          fetch: withResponse(
            mcpResponse({
              isError: true,
              content: [
                { type: 'text', text: 'Mintlify rejected the feedback.' },
              ],
            })
          ),
        }
      )
    );
    expect(toolError.message).toBe(
      "MCP tool 'submit_feedback' failed: Mintlify rejected the feedback."
    );

    const malformed = await rejection(
      callMcp(
        SEARCH_TOOL,
        { query: 'bad' },
        {
          fetch: withResponse(new Response('nope')),
        }
      )
    );
    expect(malformed.message).toBe(
      'MCP response was not valid SSE or JSON-RPC JSON.'
    );
  });
});

function mockFetch(response: Response | (() => Response | Promise<Response>)): {
  readonly calls: FetchCall[];
  readonly fetch: FetchLike;
} {
  const calls: FetchCall[] = [];
  const fetch: FetchLike = async (input, init) => {
    calls.push({ input, init });
    return typeof response === 'function' ? response() : response.clone();
  };
  return { calls, fetch };
}

function withResponse(response: Response): FetchLike {
  return () => Promise.resolve(response);
}

function mcpResponse(result: unknown): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\ndata: [DONE]\n\n`,
    { headers: { 'content-type': 'text/event-stream' } }
  );
}

function jsonRpcResponse(message: Readonly<Record<string, unknown>>): Response {
  return new Response(
    `data: ${JSON.stringify({ jsonrpc: '2.0', id: 1, ...message })}\n\n`,
    { headers: { 'content-type': 'text/event-stream' } }
  );
}

function mcpHeaders(): Readonly<Record<string, string>> {
  return {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-03-26',
  };
}

function requestBody(init: RequestInit | undefined): string {
  if (typeof init?.body !== 'string') {
    throw new TypeError('expected a JSON string request body');
  }
  return init.body;
}

async function rejection(operation: Promise<unknown>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error('operation unexpectedly succeeded');
}

async function awaitRejected<T>(
  operation: Promise<T>,
  errorType: new (...args: never[]) => Error
): Promise<void> {
  const error = await rejection(operation);
  expect(error).toBeInstanceOf(errorType);
}
