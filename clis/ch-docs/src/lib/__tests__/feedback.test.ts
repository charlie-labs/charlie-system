import { describe, expect, test } from 'bun:test';

import { FEEDBACK_TOOL } from '../config.js';
import type { FetchLike } from '../contracts.js';
import { DocsInvocationError } from '../errors.js';
import { submitFeedback } from '../operations.js';

type FetchCall = Readonly<{
  readonly init: RequestInit | undefined;
  readonly input: RequestInfo | URL;
}>;

describe('feedback submission', () => {
  test('normalizes URL paths and sends one exact non-idempotent request', async () => {
    const { fetch, calls } = mockFetch(
      mcpResponse({ content: [{ type: 'text', text: 'Feedback recorded.' }] })
    );
    const feedback = 'The example uses "old" && $HOME; $(echo unsafe)';

    expect(
      (
        await submitFeedback(
          'https://charlie-v3.mintlify.site/guides/tasks?source=sidebar#feedback',
          feedback,
          { fetch }
        )
      ).content
    ).toBe('Feedback recorded.');
    expect(JSON.parse(requestBody(calls[0]?.init))).toMatchObject({
      params: {
        name: FEEDBACK_TOOL,
        arguments: { path: '/guides/tasks', feedback },
      },
    });
    expect(calls).toHaveLength(1);
  });

  test('accepts relative paths, rejects credentials/origins, and never retries', async () => {
    const { fetch, calls } = mockFetch(
      mcpResponse({ content: [{ type: 'text', text: 'ok' }] })
    );
    expect(
      (
        await submitFeedback('/guides/tasks?source=sidebar#heading', 'clear', {
          fetch,
        })
      ).content
    ).toBe('ok');
    expect(JSON.parse(requestBody(calls[0]?.init))).toMatchObject({
      params: { arguments: { path: '/guides/tasks', feedback: 'clear' } },
    });

    await Promise.all(
      [
        'https://example.com/guides/tasks',
        'https://user:password@charlie-v3.mintlify.site/guides/tasks',
      ].map((value) =>
        awaitRejected(
          submitFeedback(value, 'clear', { fetch }),
          DocsInvocationError
        )
      )
    );

    let attempts = 0;
    const failingFetch: FetchLike = () => {
      attempts += 1;
      return Promise.reject(new Error('connection reset after request'));
    };
    const error = await rejection(
      submitFeedback('/guides/tasks', 'clear', { fetch: failingFetch })
    );
    expect(error.message).toBe('connection reset after request');
    expect(attempts).toBe(1);
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

function mcpResponse(result: unknown): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\ndata: [DONE]\n\n`,
    { headers: { 'content-type': 'text/event-stream' } }
  );
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
