import ky, { HTTPError, type Options } from 'ky';
import { z } from 'zod3';

import {
  isSlackErrorEnvelope,
  pickSlackErrorMessage,
  SLACK_ERROR_CODE_INVALID_AUTH,
  SLACK_ERROR_CODE_NOT_AUTHED,
  SLACK_ERROR_CODE_RATE_LIMITED,
  SlackApiError,
  SlackAuthError,
  type SlackErrorEnvelope,
  SlackRateLimitError,
} from './errors.js';

export const SLACK_API_BASE_URL = 'https://slack.com/api';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 4_000;
const DEFAULT_BACKOFF_FACTOR = 2;
const DEFAULT_RATE_LIMIT_RETRY_LIMIT = 1;

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);

const SlackEnvelopeSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();

type SlackSuccessEnvelope = z.infer<typeof SlackEnvelopeSchema> & {
  ok: true;
};

export type SlackHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SlackHttpRequestOptions {
  readonly path: string;
  readonly method?: SlackHttpMethod;
  readonly searchParams?: Record<
    string,
    string | number | boolean | null | undefined
  >;
  readonly json?: Record<string, unknown> | undefined;
  readonly formData?: FormData;
  readonly body?: BodyInit | null;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface SlackHttpResponse<Data = SlackSuccessEnvelope> {
  readonly data: Data;
  readonly status: number;
  readonly requestId?: string | undefined;
  readonly headers: Headers;
}

interface SlackHttpEventBase {
  readonly method: SlackHttpMethod;
  readonly path: string;
  readonly attempt: number;
}

export type SlackHttpEvent =
  | (SlackHttpEventBase & { readonly type: 'request:start' })
  | (SlackHttpEventBase & {
      readonly type: 'request:success';
      readonly status: number;
      readonly durationMs: number;
      readonly requestId?: string | undefined;
    })
  | (SlackHttpEventBase & {
      readonly type: 'request:retry';
      readonly status?: number;
      readonly reason: 'rate_limit' | 'http_error' | 'network_error';
      readonly delayMs: number;
      readonly requestId?: string | undefined;
    })
  | (SlackHttpEventBase & {
      readonly type: 'request:error';
      readonly error: SlackApiError;
      readonly status: number;
      readonly requestId?: string | undefined;
      readonly durationMs: number;
    });

export interface SlackClientSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: Error): void;
  end(): void;
}

export interface SlackClientTracer {
  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>
  ): SlackClientSpan;
}

export interface SlackHttpClientOptions {
  readonly token: string;
  readonly userAgent?: string;
  readonly maxAttempts?: number;
  readonly initialRetryDelayMs?: number;
  readonly maxRetryDelayMs?: number;
  readonly backoffFactor?: number;
  readonly rateLimitRetryLimit?: number;
  readonly events?: (event: SlackHttpEvent) => void;
  readonly tracer?: SlackClientTracer;
  readonly wait?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
}

export interface SlackHttpClient {
  request(options: SlackHttpRequestOptions): Promise<SlackHttpResponse>;
}

interface NormalizedError {
  readonly error: SlackApiError;
  readonly retryable: boolean;
  readonly retryDelayMs?: number | undefined;
  readonly reason: 'rate_limit' | 'http_error' | 'network_error';
  readonly isRateLimit: boolean;
}

export function createSlackHttpClient(
  options: SlackHttpClientOptions
): SlackHttpClient {
  const {
    token,
    userAgent,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    initialRetryDelayMs = DEFAULT_INITIAL_RETRY_DELAY_MS,
    maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
    backoffFactor = DEFAULT_BACKOFF_FACTOR,
    rateLimitRetryLimit = DEFAULT_RATE_LIMIT_RETRY_LIMIT,
    events,
    tracer,
    wait = (ms) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }),
    now = () => Date.now(),
    fetch: fetchImpl,
  } = options;

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json; charset=utf-8',
  };

  if (typeof userAgent === 'string' && userAgent.length > 0) {
    baseHeaders['User-Agent'] = userAgent;
  }

  const instance = ky.create({
    prefixUrl: SLACK_API_BASE_URL,
    headers: baseHeaders,
    retry: 0,
    timeout: false,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });

  async function request(
    optionsOrPath: SlackHttpRequestOptions
  ): Promise<SlackHttpResponse> {
    const {
      path,
      method = 'POST',
      searchParams,
      json,
      formData,
      body,
      headers,
      signal,
      timeoutMs,
    } = optionsOrPath;

    let attempt = 0;
    let rateLimitRetries = 0;

    while (true) {
      attempt += 1;

      const attemptStart = now();
      events?.({ type: 'request:start', path, method, attempt });

      const span = tracer?.startSpan('slack.http.request', {
        'slack.method': method,
        'slack.path': path,
        attempt,
      });

      try {
        const builtSearchParams = buildSearchParams(searchParams);
        const options: Options = {
          method,
          // Preserve instance default headers (incl. Authorization).
          // Only set per-request headers when provided to avoid overriding
          // ky instance defaults with `undefined`.
          ...(builtSearchParams ? { searchParams: builtSearchParams } : {}),
          ...(signal ? { signal } : {}),
          timeout: typeof timeoutMs === 'number' ? timeoutMs : false,
        };

        if (headers && Object.keys(headers).length > 0) {
          // Merge with base headers to ensure Authorization/User-Agent persist when callers
          // provide a smaller per-request header set (e.g., only Content-Type).
          options.headers = { ...baseHeaders, ...headers };
        }

        if (formData) {
          options.body = formData;
        } else if (json) {
          options.json = json;
        } else if (body !== undefined) {
          options.body = body;
        }

        const response = await instance(path, options);
        const requestId = response.headers.get('x-slack-req-id') ?? undefined;
        const raw = await response.json();
        const envelope = SlackEnvelopeSchema.parse(raw);

        if (!envelope.ok) {
          const derivedError = createErrorFromEnvelope({
            envelope: envelope as SlackErrorEnvelope,
            status: response.status,
            requestId,
            responseBody: raw,
          });
          span?.recordException(derivedError);
          span?.setAttribute('http.status_code', response.status);
          span?.setAttribute('slack.request_id', requestId ?? '');
          span?.end();
          throw derivedError;
        }

        span?.setAttribute('http.status_code', response.status);
        if (requestId) {
          span?.setAttribute('slack.request_id', requestId);
        }
        span?.end();

        const durationMs = now() - attemptStart;
        events?.({
          type: 'request:success',
          path,
          method,
          attempt,
          status: response.status,
          durationMs,
          requestId,
        });

        return {
          data: envelope as SlackSuccessEnvelope,
          status: response.status,
          requestId,
          headers: response.headers,
        };
      } catch (rawError) {
        const normalized = await normalizeError(rawError, {
          attempt,
          initialRetryDelayMs,
          maxRetryDelayMs,
          backoffFactor,
          now,
        });

        const durationMs = now() - attemptStart;

        if (normalized.error instanceof SlackRateLimitError) {
          span?.setAttribute('http.status_code', normalized.error.status);
          if (normalized.error.requestId) {
            span?.setAttribute('slack.request_id', normalized.error.requestId);
          }
        }

        span?.recordException(normalized.error);
        span?.end();

        const isStandardRetryEligible =
          normalized.retryable &&
          attempt < maxAttempts &&
          !normalized.isRateLimit;
        const isRateLimitRetryEligible =
          normalized.isRateLimit && rateLimitRetries < rateLimitRetryLimit;

        if (normalized.isRateLimit && normalized.retryable) {
          rateLimitRetries += 1;
        }

        if (
          normalized.retryable &&
          (isStandardRetryEligible || isRateLimitRetryEligible)
        ) {
          const delayMs = normalized.isRateLimit
            ? (normalized.retryDelayMs ?? initialRetryDelayMs)
            : (normalized.retryDelayMs ??
              computeBackoffDelay({
                attempt,
                initialRetryDelayMs,
                maxRetryDelayMs,
                backoffFactor,
              }));

          events?.({
            type: 'request:retry',
            path,
            method,
            attempt,
            status: normalized.error.status,
            reason: normalized.reason,
            delayMs,
            requestId: normalized.error.requestId,
          });

          await wait(delayMs);
          continue;
        }

        events?.({
          type: 'request:error',
          path,
          method,
          attempt,
          error: normalized.error,
          status: normalized.error.status,
          requestId: normalized.error.requestId,
          durationMs,
        });

        throw normalized.error;
      }
    }
  }

  return { request };
}

function buildSearchParams(
  params?: Record<string, string | number | boolean | null | undefined>
): URLSearchParams | undefined {
  if (!params) {
    return undefined;
  }

  const definedEntries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null
  );
  if (definedEntries.length === 0) {
    return undefined;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of definedEntries) {
    if (typeof value === 'boolean') {
      searchParams.set(key, value ? 'true' : 'false');
      continue;
    }

    searchParams.set(key, String(value));
  }

  return searchParams;
}

function computeBackoffDelay(args: {
  readonly attempt: number;
  readonly initialRetryDelayMs: number;
  readonly maxRetryDelayMs: number;
  readonly backoffFactor: number;
}): number {
  const { attempt, initialRetryDelayMs, maxRetryDelayMs, backoffFactor } = args;
  const exponential =
    initialRetryDelayMs * backoffFactor ** Math.max(0, attempt - 1);
  return Math.min(maxRetryDelayMs, Math.round(exponential));
}

async function normalizeError(
  error: unknown,
  context: {
    readonly attempt: number;
    readonly initialRetryDelayMs: number;
    readonly maxRetryDelayMs: number;
    readonly backoffFactor: number;
    readonly now: () => number;
  }
): Promise<NormalizedError> {
  if (error instanceof SlackRateLimitError) {
    return {
      error,
      retryable: true,
      retryDelayMs: error.retryAfterMs,
      reason: 'rate_limit',
      isRateLimit: true,
    };
  }

  if (error instanceof SlackAuthError) {
    return {
      error,
      retryable: false,
      reason: 'http_error',
      isRateLimit: false,
    };
  }

  if (error instanceof SlackApiError) {
    return {
      error,
      retryable: false,
      reason: 'http_error',
      isRateLimit: false,
    };
  }

  if (error instanceof HTTPError) {
    return handleHttpError(error, context);
  }

  const cause = error instanceof Error ? error : undefined;
  const networkError = new SlackApiError('Slack network request failed', {
    status: 0,
    code: 'network_error',
    requestId: undefined,
    cause,
  });

  return {
    error: networkError,
    retryable: true,
    reason: 'network_error',
    isRateLimit: false,
  };
}

async function handleHttpError(
  httpError: HTTPError,
  context: {
    readonly attempt: number;
    readonly initialRetryDelayMs: number;
    readonly maxRetryDelayMs: number;
    readonly backoffFactor: number;
    readonly now: () => number;
  }
): Promise<NormalizedError> {
  const response = httpError.response;
  const status = response.status;
  const requestId = response.headers.get('x-slack-req-id') ?? undefined;
  const body = await readResponseBody(response);
  const headersRecord = collectHeaders(response.headers);

  if (status === 429) {
    const retryAfterMs = parseRetryAfter(
      response.headers.get('Retry-After'),
      context.now
    );
    const envelope = isSlackErrorEnvelope(body) ? body : undefined;
    const message = envelope
      ? pickSlackErrorMessage(envelope)
      : 'Slack rate limit exceeded';
    const rateLimitError = new SlackRateLimitError(message, {
      status,
      code: envelope?.error ?? SLACK_ERROR_CODE_RATE_LIMITED,
      requestId,
      retryAfterMs,
      metadata: { responseBody: body, headers: headersRecord },
    });

    return {
      error: rateLimitError,
      retryable: true,
      retryDelayMs: retryAfterMs,
      reason: 'rate_limit',
      isRateLimit: true,
    };
  }

  const envelope = isSlackErrorEnvelope(body) ? body : undefined;
  const code = envelope?.error ?? response.statusText;
  const message = envelope
    ? pickSlackErrorMessage(envelope)
    : `Slack HTTP ${status}`;

  const metadata = { responseBody: body, headers: headersRecord };

  if (
    status === 401 ||
    status === 403 ||
    code === SLACK_ERROR_CODE_INVALID_AUTH ||
    code === SLACK_ERROR_CODE_NOT_AUTHED
  ) {
    const authError = new SlackAuthError(message, {
      status,
      code,
      requestId,
      metadata,
    });

    return {
      error: authError,
      retryable: false,
      reason: 'http_error',
      isRateLimit: false,
    };
  }

  const retryable = RETRYABLE_STATUS_CODES.has(status);
  const slackError = new SlackApiError(message, {
    status,
    code,
    requestId,
    metadata,
  });

  const retryDelayMs = retryable
    ? computeBackoffDelay({
        attempt: context.attempt,
        initialRetryDelayMs: context.initialRetryDelayMs,
        maxRetryDelayMs: context.maxRetryDelayMs,
        backoffFactor: context.backoffFactor,
      })
    : undefined;

  return {
    error: slackError,
    retryable,
    retryDelayMs,
    reason: 'http_error',
    isRateLimit: false,
  };
}

function parseRetryAfter(
  value: string | null,
  now: () => number
): number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.round(numeric * 1_000);
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const delta = timestamp - now();
  return delta > 0 ? delta : undefined;
}

function collectHeaders(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const clone = response.clone();
  const text = await clone.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createErrorFromEnvelope(args: {
  readonly envelope: SlackErrorEnvelope;
  readonly status: number;
  readonly requestId?: string | undefined;
  readonly responseBody: unknown;
}): SlackApiError {
  const { envelope, status, requestId, responseBody } = args;
  const message = pickSlackErrorMessage(envelope);
  const metadata = { responseBody, headers: undefined };

  if (
    envelope.error === SLACK_ERROR_CODE_RATE_LIMITED ||
    envelope.error === 'ratelimited'
  ) {
    return new SlackRateLimitError(message, {
      status,
      code: envelope.error,
      requestId,
      metadata,
    });
  }

  if (
    envelope.error === SLACK_ERROR_CODE_INVALID_AUTH ||
    envelope.error === SLACK_ERROR_CODE_NOT_AUTHED
  ) {
    return new SlackAuthError(message, {
      status,
      code: envelope.error,
      requestId,
      metadata,
    });
  }

  return new SlackApiError(message, {
    status,
    code: envelope.error,
    requestId,
    metadata,
  });
}
