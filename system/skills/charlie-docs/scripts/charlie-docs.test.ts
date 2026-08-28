import { describe, expect, test } from 'bun:test';

import { execute, main } from './charlie-docs.js';

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type FetchCall = {
  readonly input: RequestInfo | URL;
  readonly init: RequestInit | undefined;
};

describe('page retrieval', () => {
  test(
    'uses an exact Markdown URL without appending a guessed suffix',
    testExactPageUrl
  );
  test('uses the Markdown Accept header for a page path', testPagePath);
});

describe('MCP retrieval', () => {
  test('JSON-encodes shell-sensitive search queries', testSearchQuery);
  test(
    'JSON-encodes filesystem commands and extracts stdout',
    testFilesystemCommand
  );
});

describe('failure handling', () => {
  test('surfaces HTTP, JSON-RPC, and remote-command failures', testFailures);
});

async function testExactPageUrl(): Promise<void> {
  const { fetch, calls } = mockFetch(new Response('exact page content'));
  const content = await execute(
    ['page', 'https://docs.charlielabs.ai/guides/exact.md'],
    fetch
  );

  expect(content).toBe('exact page content');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.input).toBe('https://docs.charlielabs.ai/guides/exact.md');
  expect(calls[0]?.init?.headers).toEqual({ Accept: 'text/markdown' });
}

async function testPagePath(): Promise<void> {
  const { fetch, calls } = mockFetch(new Response('# Installation\n'));
  const content = await execute(['page', '/installation'], fetch);

  expect(content).toBe('# Installation\n');
  expect(calls[0]?.input).toBe('https://docs.charlielabs.ai/installation');
  expect(calls[0]?.init?.headers).toEqual({ Accept: 'text/markdown' });
}

async function testSearchQuery(): Promise<void> {
  const { fetch, calls } = mockFetch(
    contentResponse('Title: Configuration\nContent: exact result')
  );
  const query = 'quotes " && $HOME; $(echo unsafe)';
  const content = await execute(['search', query], fetch);

  expect(content).toBe('Title: Configuration\nContent: exact result');
  expect(calls[0]?.input).toBe('https://docs.charlielabs.ai/mcp');
  expect(calls[0]?.init?.headers).toEqual(mcpHeaders());
  expect(JSON.parse(requestBody(calls[0]?.init))).toEqual({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'search_charlie_labs',
      arguments: { query },
    },
  });
}

async function testFilesystemCommand(): Promise<void> {
  const { fetch, calls } = mockFetch(
    contentResponse(
      'exit: 0\n--- stdout ---\n/path/page.mdx:1: docs & details\n--- stderr ---\n'
    )
  );
  const command = "rg -n 'docs & details' /";
  const content = await execute(['filesystem', command], fetch);

  expect(content).toBe('/path/page.mdx:1: docs & details\n');
  expect(JSON.parse(requestBody(calls[0]?.init))).toMatchObject({
    params: {
      name: 'query_docs_filesystem_charlie_labs',
      arguments: { command },
    },
  });
}

async function testFailures(): Promise<void> {
  const http = mockFetch(
    () => new Response('upstream unavailable', { status: 503 })
  );
  const httpMessage = await rejectionMessage(execute(['index'], http.fetch));
  const httpIo = captureIo();
  const httpExitCode = await main(['index'], {
    fetch: http.fetch,
    io: httpIo.io,
  });

  expect(httpMessage).toBe('HTTP 503: upstream unavailable');
  expect(httpExitCode).toBe(1);
  expect(httpIo.stderr()).toContain('HTTP 503: upstream unavailable');

  const jsonRpc = mockFetch(
    new Response(
      `data: ${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'invalid query' },
      })}\n\n`
    )
  );
  const jsonRpcMessage = await rejectionMessage(
    execute(['search', 'bad'], jsonRpc.fetch)
  );
  expect(jsonRpcMessage).toBe('MCP JSON-RPC error (-32602): invalid query');

  const remote = mockFetch(
    contentResponse(
      'exit: 2\n--- stdout ---\n\n--- stderr ---\ncommand failed\n'
    )
  );
  const remoteIo = captureIo();
  const remoteExitCode = await main(['filesystem', 'cat /missing.mdx'], {
    fetch: remote.fetch,
    io: remoteIo.io,
  });

  expect(remoteExitCode).toBe(1);
  expect(remoteIo.stderr()).toContain(
    'remote filesystem command failed with exit 2'
  );
}

function mockFetch(response: Response | (() => Response | Promise<Response>)): {
  readonly fetch: FetchLike;
  readonly calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetch: FetchLike = async (input, init) => {
    calls.push({ input, init });
    return typeof response === 'function' ? response() : response;
  };
  return { fetch, calls };
}

function mcpResponse(result: unknown): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\n`,
    { headers: { 'content-type': 'text/event-stream' } }
  );
}

function contentResponse(text: string, isError = false): Response {
  return mcpResponse({ isError, content: [{ type: 'text', text }] });
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

async function rejectionMessage(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('operation unexpectedly succeeded');
}

function captureIo(): {
  readonly io: {
    readonly stdout: (text: string) => void;
    readonly stderr: (text: string) => void;
  };
  readonly stdout: () => string;
  readonly stderr: () => string;
} {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}
