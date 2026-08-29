export type ErrorCodeString =
  | 'EVALIDATION'
  | 'ERESOURCE_NOT_FOUND'
  | 'ECONFLICT'
  | 'EUNAUTHORIZED'
  | 'ERATELIMIT'
  | 'ESVCUNAVAILABLE'
  | 'ECANCELED'
  | 'EAPI';

/** Validation/usage error (exit 2). */
export class ValidationError extends Error {
  static readonly exitCode = 2;
  readonly code: ErrorCodeString = 'EVALIDATION';
}

/** Not found / ambiguous resolution (exit 3). */
export class NotFoundError extends Error {
  static readonly exitCode = 3;
  readonly code: ErrorCodeString = 'ERESOURCE_NOT_FOUND';
}

/** Conflict / precondition failed (exit 4). */
export class ConflictError extends Error {
  static readonly exitCode = 4;
  readonly code: ErrorCodeString = 'ECONFLICT';
}

/** Unauthorized / forbidden (exit 5). */
export class UnauthorizedError extends Error {
  static readonly exitCode = 5;
  readonly code: ErrorCodeString = 'EUNAUTHORIZED';
}

/** Rate limited (exit 6). */
export class RateLimitedError extends Error {
  static readonly exitCode = 6;
  readonly code: ErrorCodeString = 'ERATELIMIT';
}

/** Service unavailable / timeout / network (exit 7). */
export class ServiceUnavailableError extends Error {
  static readonly exitCode = 7;
  readonly code: ErrorCodeString = 'ESVCUNAVAILABLE';
}

/** User canceled (exit 8). */
export class CanceledError extends Error {
  static readonly exitCode = 8;
  readonly code: ErrorCodeString = 'ECANCELED';
}

/** API transport-level failure (wraps a lower-level cause). */
export class ApiRequestError extends Error {
  static readonly exitCode = 1;
  readonly code: ErrorCodeString = 'EAPI';
  constructor(message: string, cause?: unknown) {
    // Pass the cause to the native Error options so it is available as error.cause
    // in environments that support it.
    super(message, { cause });
  }
}

/**
 * Return a stable exit code for any thrown error.
 * Order: instance.exitCode → ctor.exitCode → code-string → name → instanceof → 1
 */
export function errorToExitCode(err: unknown): number {
  const anyErr = err as Record<string, unknown>;

  const instExit = (anyErr as { exitCode?: unknown })?.exitCode;
  if (typeof instExit === 'number') return instExit;

  const ctorExit = (anyErr as { constructor?: { exitCode?: unknown } })
    ?.constructor?.exitCode;
  if (typeof ctorExit === 'number') return ctorExit;

  const codeMap: Partial<Record<ErrorCodeString, number>> = {
    EVALIDATION: 2,
    ERESOURCE_NOT_FOUND: 3,
    ECONFLICT: 4,
    EUNAUTHORIZED: 5,
    ERATELIMIT: 6,
    ESVCUNAVAILABLE: 7,
    ECANCELED: 8,
    EAPI: 1,
  };
  const codeStr = (anyErr as { code?: unknown })?.code;
  if (typeof codeStr === 'string' && codeMap[codeStr as ErrorCodeString]) {
    return codeMap[codeStr as ErrorCodeString]!;
  }

  const nameMap: Record<string, number> = {
    ValidationError: 2,
    NotFoundError: 3,
    ConflictError: 4,
    UnauthorizedError: 5,
    RateLimitedError: 6,
    ServiceUnavailableError: 7,
    CanceledError: 8,
    ApiRequestError: 1,
  };
  if (
    typeof (anyErr as { name?: unknown })?.name === 'string' &&
    nameMap[(anyErr as { name: string }).name]
  ) {
    return nameMap[(anyErr as { name: string }).name]!;
  }

  if (err instanceof ValidationError) return 2;
  if (err instanceof NotFoundError) return 3;
  if (err instanceof ConflictError) return 4;
  if (err instanceof UnauthorizedError) return 5;
  if (err instanceof RateLimitedError) return 6;
  if (err instanceof ServiceUnavailableError) return 7;
  if (err instanceof CanceledError) return 8;

  return 1; // unexpected/internal
}

/** Classify common transport errors for retry hints in JSON mode. */
export function isRetryableNetworkError(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  const resp = (e as { response?: { status?: unknown } }).response;
  const status =
    typeof resp?.status === 'number' ? (resp.status as number) : undefined;

  // Prefer transport-level codes from the cause; only trust top-level code
  // if it is NOT a known domain code.
  let code: string | undefined;
  const causeCode = (e as { cause?: { code?: unknown } }).cause?.code;
  if (typeof causeCode === 'string') {
    code = causeCode;
  } else {
    const maybeCode = (e as { code?: unknown }).code;
    if (
      typeof maybeCode === 'string' &&
      !DOMAIN_CODES.has(maybeCode as ErrorCodeString)
    ) {
      code = maybeCode as string;
    }
  }

  return (
    (typeof status === 'number' && RETRYABLE_STATUSES.has(status)) ||
    (typeof code === 'string' && RETRYABLE_CODES.has(code))
  );
}

// Hoisted constants to avoid per-call allocations
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);
const DOMAIN_CODES = new Set<ErrorCodeString>([
  'EVALIDATION',
  'ERESOURCE_NOT_FOUND',
  'ECONFLICT',
  'EUNAUTHORIZED',
  'ERATELIMIT',
  'ESVCUNAVAILABLE',
  'ECANCELED',
  'EAPI',
]);

/**
 * Get the string error message from an unknown value.
 * Makes a best effort at the message to assure a string is always returned.
 */
export function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message;
}

// Type intentionally not exported
type ErrorWithMessage = { message: string };

/** Guard for an Error object with a string message property. */
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>)['message'] === 'string'
  );
}

/**
 * Force an unknown (but likely Error) value to be an Error with a message.
 * Uses the stringified object as the message if message is not present.
 */
function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;
  if (typeof maybeError === 'string') return new Error(maybeError);
  try {
    const json = JSON.stringify(maybeError);
    return new Error(json ?? 'Unknown error');
  } catch {
    // fallback in case there's an error stringifying the maybeError
    // like with circular references for example.
    return new Error(String(maybeError ?? 'Unknown error'));
  }
}

/** Check if a value is an Error. */
export function isError(value: unknown): value is Error {
  return (
    typeof value === 'object' &&
    value !== null &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any).name === 'string' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any).message === 'string'
  );
}

/** Force an unknown (but likely Error) value to be an Error. */
export function forceError(value: unknown): Error {
  if (isError(value)) return value;
  // Derive a safe, consistent message without risking JSON.stringify() throws.
  return new Error(getErrorMessage(value));
}
