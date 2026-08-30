import {
  ApiRequestError,
  ConflictError,
  NotFoundError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@charlie-labs/oclif-plugin-helpers-zod3';

import { SentryApiError } from '../../lib/sentry-api.js';

export function mapSentryError(err: unknown): Error {
  if (err instanceof SentryApiError) {
    const withStatus = err.status
      ? `${err.message} (status ${err.status})`
      : err.message;
    switch (err.status) {
      case 401:
      case 403:
        return new UnauthorizedError(withStatus);
      case 404:
        return new NotFoundError(withStatus);
      case 409:
        return new ConflictError(withStatus);
      case 429:
        return new RateLimitedError(withStatus);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServiceUnavailableError(withStatus);
      case 408:
        return new ApiRequestError(withStatus, err);
      default:
        return new ApiRequestError(withStatus, err);
    }
  }
  return err instanceof Error
    ? err
    : new ApiRequestError('Unexpected error', err);
}
