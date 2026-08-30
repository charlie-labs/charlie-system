import {
  ApiRequestError,
  ValidationError as LibValidationError,
  NotFoundError,
  PaginationError,
} from '../../../lib/errors/index.js';
import { ResolutionError } from './resolution-error.js';
import { ValidationError as CliValidationError } from './validation-error.js';

export { ResolutionError };

export function mapError(err: unknown): { message: string; exitCode: number } {
  if (err instanceof LibValidationError || err instanceof CliValidationError) {
    return { message: err.message, exitCode: 2 };
  }
  if (err instanceof ResolutionError) {
    return { message: err.message, exitCode: 1 };
  }
  if (err instanceof NotFoundError) {
    const resource = err.resource.toLowerCase();
    return {
      message: `${resource.charAt(0).toUpperCase()}${resource.slice(1)} not found.`,
      exitCode: 1,
    };
  }
  if (err instanceof PaginationError) {
    return { message: err.message, exitCode: 1 };
  }
  if (err instanceof ApiRequestError) {
    return { message: err.message, exitCode: 1 };
  }
  if (err instanceof Error) return { message: err.message, exitCode: 1 };
  return { message: String(err), exitCode: 1 };
}
