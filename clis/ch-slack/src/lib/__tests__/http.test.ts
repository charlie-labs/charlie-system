import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SlackApiError,
  SlackAuthError,
  SlackRateLimitError,
} from '../errors.js';
import { createSlackHttpClient } from '../http.js';

const TOKEN = 'xoxb-test-token';

type FetchImplementation = (
  ...args: Parameters<typeof fetch>
) => ReturnType<typeof fetch>;

function buildFetchStub(impl: FetchImplementation): {
  fetchStub: typeof fetch;
  fetchMock: ReturnType<typeof vi.fn<FetchImplementation>>;
} {
  const fetchMock = vi.fn<FetchImplementation>(impl);
  const wrappedFetch = (
    ...args: Parameters<typeof fetch>
  ): ReturnType<typeof fetch> => fetchMock(...args);
  const fetchStub = Object.assign(wrappedFetch, {
    preconnect: vi.fn(),
  }) as typeof fetch;
  return { fetchStub, fetchMock };
}

describe('createSlackHttpClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries network failures with exponential backoff', async () => {
    const delays: number[] = [];
    let attempts = 0;

    const { fetchStub, fetchMock } = buildFetchStub(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new TypeError('network failure');
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'x-slack-req-id': 'req-123',
        },
      });
    });

    const client = createSlackHttpClient({
      token: TOKEN,
      fetch: fetchStub,
      wait: async (ms) => {
        delays.push(ms);
      },
      now: () => 0,
      initialRetryDelayMs: 200,
      backoffFactor: 2,
    });

    const response = await client.request({
      path: 'test.echo',
      method: 'POST',
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([200]);
  });

  it('maps ok:false envelopes to SlackApiError', async () => {
    const { fetchStub } = buildFetchStub(
      async () =>
        new Response(
          JSON.stringify({ ok: false, error: 'channel_not_found' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-slack-req-id': 'req-456',
            },
          }
        )
    );

    const client = createSlackHttpClient({ token: TOKEN, fetch: fetchStub });

    try {
      await client.request({ path: 'chat.postMessage', method: 'POST' });
      throw new Error('Expected SlackApiError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SlackApiError);
      const slackError = error as SlackApiError;
      expect(slackError.status).toBe(200);
      expect(slackError.code).toBe('channel_not_found');
      expect(slackError.requestId).toBe('req-456');
    }
  });

  it('honors Retry-After header for 429 responses', async () => {
    let callCount = 0;
    const { fetchStub, fetchMock } = buildFetchStub(async () => {
      const currentCall = callCount;
      callCount += 1;
      if (currentCall === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'rate_limited' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '2',
              'x-slack-req-id': 'req-789',
            },
          }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: 'ok' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'x-slack-req-id': 'req-790',
        },
      });
    });

    const observedDelays: number[] = [];
    const client = createSlackHttpClient({
      token: TOKEN,
      fetch: fetchStub,
      wait: async (ms) => {
        observedDelays.push(ms);
      },
      now: () => 0,
    });

    const response = await client.request({
      path: 'conversations.list',
      method: 'GET',
    });
    expect(response.status).toBe(200);
    expect(observedDelays).toEqual([2_000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces SlackRateLimitError when rate limit persists', async () => {
    const { fetchStub, fetchMock } = buildFetchStub(
      async () =>
        new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1',
            'x-slack-req-id': 'req-800',
          },
        })
    );

    const client = createSlackHttpClient({
      token: TOKEN,
      fetch: fetchStub,
      wait: async () => {
        /* no-op */
      },
      now: () => 0,
    });

    await expect(
      client.request({ path: 'chat.postMessage', method: 'POST' })
    ).rejects.toBeInstanceOf(SlackRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps 401 to SlackAuthError', async () => {
    const { fetchStub } = buildFetchStub(
      async () =>
        new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'x-slack-req-id': 'req-900',
          },
        })
    );

    const client = createSlackHttpClient({ token: TOKEN, fetch: fetchStub });

    await expect(
      client.request({ path: 'chat.postMessage', method: 'POST' })
    ).rejects.toBeInstanceOf(SlackAuthError);
  });
});
