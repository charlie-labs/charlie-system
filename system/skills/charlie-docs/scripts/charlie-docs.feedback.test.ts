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

describe('feedback submission', () => {
  test(
    'normalizes a page URL, sends the exact tool payload, and prints the response',
    testFeedbackSubmission
  );
  test('normalizes a site-relative page path', testFeedbackPagePath);
  test(
    'rejects invalid feedback arguments and origins',
    testFeedbackValidation
  );
  test('reports confirmed Mintlify failures', testFeedbackFailure);
  test('does not retry an ambiguous request failure', testFeedbackNoRetry);
});

async function testFeedbackSubmission(): Promise<void> {
  const { fetch, calls } = mockFetch(contentResponse('Feedback recorded.'));
  const io = captureIo();
  const feedback =
    'The example uses "old" && $HOME; $(echo unsafe)\nExpected `id` instead.';
  const exitCode = await main(
    [
      'feedback',
      'https://charlie-v3.mintlify.site/guides/example.md?source=sidebar#feedback',
      feedback,
    ],
    { fetch, io: io.io }
  );

  expect(exitCode).toBe(0);
  expect(io.stdout()).toBe('Feedback recorded.');
  expect(io.stderr()).toBe('');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.input).toBe('https://charlie-v3.mintlify.site/mcp');
  expect(calls[0]?.init?.headers).toEqual(mcpHeaders());
  expect(JSON.parse(requestBody(calls[0]?.init))).toEqual({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'submit_feedback',
      arguments: {
        path: '/guides/example.md',
        feedback,
      },
    },
  });
}

async function testFeedbackPagePath(): Promise<void> {
  const { fetch, calls } = mockFetch(contentResponse('Feedback recorded.'));
  const content = await execute(
    ['feedback', '/guides/example', 'The page is confusing'],
    fetch
  );

  expect(content).toBe('Feedback recorded.');
  expect(JSON.parse(requestBody(calls[0]?.init))).toMatchObject({
    params: {
      name: 'submit_feedback',
      arguments: {
        path: '/guides/example',
        feedback: 'The page is confusing',
      },
    },
  });
}

async function testFeedbackValidation(): Promise<void> {
  const invalidArguments = [
    ['feedback'],
    ['feedback', ''],
    ['feedback', '   ', 'The page is wrong'],
    ['feedback', '/guides/example', '   '],
  ] as const;

  const invalidResults = await Promise.all(
    invalidArguments.map(async (argv) => {
      const { fetch, calls } = mockFetch(new Response('unexpected request'));
      return { calls, message: await rejectionMessage(execute(argv, fetch)) };
    })
  );
  for (const { calls, message } of invalidResults) {
    expect(message).toContain(
      'feedback requires a page path and feedback text.'
    );
    expect(calls).toHaveLength(0);
  }

  const otherOrigin = mockFetch(new Response('unexpected request'));
  const message = await rejectionMessage(
    execute(
      ['feedback', 'https://example.com/guides/example', 'The page is wrong'],
      otherOrigin.fetch
    )
  );

  expect(message).toBe('page URL must use https://charlie-v3.mintlify.site.');
  expect(otherOrigin.calls).toHaveLength(0);
}

async function testFeedbackFailure(): Promise<void> {
  const { fetch, calls } = mockFetch(
    contentResponse('Mintlify rejected the feedback.', true)
  );
  const io = captureIo();
  const exitCode = await main(
    ['feedback', '/guides/example', 'The page is confusing'],
    { fetch, io: io.io }
  );

  expect(exitCode).toBe(1);
  expect(io.stdout()).toBe('');
  expect(io.stderr()).toContain(
    "MCP tool 'submit_feedback' failed: Mintlify rejected the feedback."
  );
  expect(calls).toHaveLength(1);
}

async function testFeedbackNoRetry(): Promise<void> {
  const { fetch, calls } = mockFetch(() => {
    throw new Error('connection reset after request');
  });
  const io = captureIo();
  const exitCode = await main(
    ['feedback', '/guides/example', 'The page is confusing'],
    { fetch, io: io.io }
  );

  expect(exitCode).toBe(1);
  expect(io.stdout()).toBe('');
  expect(io.stderr()).toContain('connection reset after request');
  expect(calls).toHaveLength(1);
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
