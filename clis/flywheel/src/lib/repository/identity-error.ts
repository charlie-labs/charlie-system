export class RepositoryIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryIdentityError';
  }
}
