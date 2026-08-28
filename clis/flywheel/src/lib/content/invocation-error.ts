export class ContentInvocationError extends Error {
  static readonly exitCode = 2;

  readonly code = 'ECONTENT_INVOCATION';
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(message: string) {
    super(message);
    this.name = 'ContentInvocationError';
  }
}
