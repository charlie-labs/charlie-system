import type { SetupCopyResult } from './setup/contract.js';

export class ContentSetupError extends Error {
  static readonly exitCode = 2;

  readonly code = 'ECONTENT_SETUP';
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;
  readonly path: string;
  readonly reason: string;
  readonly result: SetupCopyResult;

  constructor(
    path: string,
    reason: string,
    result: SetupCopyResult,
    options?: ErrorOptions
  ) {
    super(`content setup cannot scaffold ${path}: ${reason}`, options);
    this.name = 'ContentSetupError';
    this.path = path;
    this.reason = reason;
    this.result = result;
  }
}
