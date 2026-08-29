/**
 * ValidationError is raised for invalid user input or flag/value combinations.
 *
 * CLI layers map this to exit code 2 and should not treat it as an internal
 * error. The error message should be user-friendly and actionable.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
