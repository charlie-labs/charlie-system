export class ExactSearchOperationalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ExactSearchOperationalError';
  }
}
