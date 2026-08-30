/** ResolutionError indicates a human-friendly identifier could not be resolved or was ambiguous. */
export class ResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolutionError';
  }
}
