import { expect, test } from 'bun:test';

import {
  ApiRequestError,
  CanceledError,
  ConflictError,
  errorToExitCode,
  NotFoundError,
  RateLimitedError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../src/errors/index.js';

test('errorToExitCode maps known classes', () => {
  expect(errorToExitCode(new ValidationError('x'))).toBe(2);
  expect(errorToExitCode(new NotFoundError('x'))).toBe(3);
  expect(errorToExitCode(new ConflictError('x'))).toBe(4);
  expect(errorToExitCode(new UnauthorizedError('x'))).toBe(5);
  expect(errorToExitCode(new RateLimitedError('x'))).toBe(6);
  expect(errorToExitCode(new ServiceUnavailableError('x'))).toBe(7);
  expect(errorToExitCode(new CanceledError('x'))).toBe(8);
  expect(errorToExitCode(new ApiRequestError('x'))).toBe(1);
});

test('errorToExitCode uses instance.exitCode override', () => {
  const e = new Error('custom') as any;
  e.exitCode = 123;
  expect(errorToExitCode(e)).toBe(123);
});

test('errorToExitCode uses code string', () => {
  const e = new Error('validation') as any;
  e.code = 'EVALIDATION';
  expect(errorToExitCode(e)).toBe(2);
});
