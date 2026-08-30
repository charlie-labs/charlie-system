/**
 * Require that dependency injection has been initialized for a command.
 *
 * BaseCommand currently types `deps` as `D | undefined` even when a command
 * declares `Deps<D>`. Until the framework tightens that, use this helper to
 * eliminate non-null assertions and surface a clear error if wiring is ever
 * missed.
 */
export function requireDeps<D>(deps: D | undefined): D {
  if (deps == null) {
    throw new Error(
      'internal: deps not initialized; ensure static buildDeps() returns a value'
    );
  }
  return deps;
}
