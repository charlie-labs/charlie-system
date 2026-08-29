export class KnowledgeOperationalError extends Error {
  static readonly exitCode = 2;

  readonly code = 'EKNOWLEDGE_OPERATIONAL';
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KnowledgeOperationalError';
  }
}
