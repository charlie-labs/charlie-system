type SlackErrorCode = string;

interface SlackErrorMetadata {
  readonly responseBody?: unknown;
  readonly headers?:
    | ReadonlyMap<string, string>
    | Record<string, string>
    | undefined;
}

interface SlackErrorOptions extends ErrorOptions {
  readonly status: number;
  readonly code?: SlackErrorCode | undefined;
  readonly requestId?: string | undefined;
  readonly retryAfterMs?: number | undefined;
  readonly metadata?: SlackErrorMetadata | undefined;
}

export class SlackApiError extends Error {
  readonly status: number;
  readonly code?: SlackErrorCode | undefined;
  readonly requestId?: string | undefined;
  readonly retryAfterMs?: number | undefined;
  readonly metadata?: SlackErrorMetadata | undefined;

  constructor(message: string, options: SlackErrorOptions) {
    super(message, options);
    this.name = 'SlackApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
    this.metadata = options.metadata;
  }
}

export class SlackRateLimitError extends SlackApiError {
  constructor(message: string, options: SlackErrorOptions) {
    super(message, {
      ...options,
      status: options.status === 0 ? 429 : options.status,
    });
    this.name = 'SlackRateLimitError';
  }
}

export class SlackAuthError extends SlackApiError {
  constructor(message: string, options: SlackErrorOptions) {
    super(message, options);
    this.name = 'SlackAuthError';
  }
}

export interface SlackErrorEnvelope {
  readonly ok: false;
  readonly error: string;
  readonly needed?: string;
  readonly provided?: string;
  readonly response_metadata?: {
    readonly messages?: readonly string[];
    readonly scopes?: readonly string[];
  };
  readonly [key: string]: unknown;
}

export const SLACK_ERROR_CODE_RATE_LIMITED = 'rate_limited';
export const SLACK_ERROR_CODE_INVALID_AUTH = 'invalid_auth';
export const SLACK_ERROR_CODE_NOT_AUTHED = 'not_authed';

export function isSlackErrorEnvelope(
  value: unknown
): value is SlackErrorEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const maybeEnvelope = value as Record<string, unknown>;
  return (
    maybeEnvelope['ok'] === false && typeof maybeEnvelope['error'] === 'string'
  );
}

export function pickSlackErrorMessage(envelope: SlackErrorEnvelope): string {
  const core = `Slack API error: ${envelope.error}`;
  const metadata: string[] = [];

  if (typeof envelope.needed === 'string' && envelope.needed.length > 0) {
    metadata.push(`needed=${envelope.needed}`);
  }

  if (typeof envelope.provided === 'string' && envelope.provided.length > 0) {
    metadata.push(`provided=${envelope.provided}`);
  }

  if (Array.isArray(envelope.response_metadata?.messages)) {
    metadata.push(`messages=${envelope.response_metadata.messages.join(',')}`);
  }

  return metadata.length > 0 ? `${core} (${metadata.join('; ')})` : core;
}
