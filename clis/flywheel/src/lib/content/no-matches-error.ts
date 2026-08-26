export class ContentNoMatchesError extends Error {
  static readonly exitCode = 1;

  readonly code = 'ECONTENT_NO_MATCHES';
  readonly exitCode = 1;

  constructor() {
    super('no matches');
    this.name = 'ContentNoMatchesError';
  }
}
