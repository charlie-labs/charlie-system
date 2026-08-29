import { Errors } from '@oclif/core';

import { errorToExitCode, forceError, isError } from './errors/index.js';

export async function handle(err: unknown): Promise<void> {
  const exitCode = errorToExitCode(err);
  const toHandle = isError(err) ? err : forceError(err);
  await Errors.handle(toHandle);
  process.exitCode = exitCode;
}
