import { ValidationError } from '@charlie-labs/oclif-plugin-helpers';

export class DocsInvocationError extends ValidationError {
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(message: string) {
    super(message);
    this.name = 'DocsInvocationError';
  }
}
