export class ContentOperationalError extends Error {
  static readonly exitCode = 2;

  readonly code = 'ECONTENT_OPERATIONAL';
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ContentOperationalError';
  }
}
