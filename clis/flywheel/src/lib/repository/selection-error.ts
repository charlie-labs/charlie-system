export class RepositorySelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositorySelectionError';
  }
}
