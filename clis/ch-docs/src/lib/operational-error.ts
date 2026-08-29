import { ApiRequestError } from '@charlie-labs/oclif-plugin-helpers';

export class DocsOperationalError extends ApiRequestError {
  readonly exitCode = 1;
  readonly oclif = { exit: 1 } as const;

  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'DocsOperationalError';
  }
}
