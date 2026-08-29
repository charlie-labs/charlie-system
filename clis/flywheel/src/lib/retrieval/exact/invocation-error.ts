export class ExactSearchInvocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExactSearchInvocationError';
  }
}
