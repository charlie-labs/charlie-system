export class RepositoryPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryPathError';
  }
}
