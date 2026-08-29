import fc, { assert } from 'fast-check';

const localRunCount = 250;
const ciRunCount = 100;

/**
 * Replay a minimized failure with:
 *
 * FAST_CHECK_SEED=123 FAST_CHECK_PATH=42:1 bun test clis/flywheel/src/lib/<area>/__tests__/property.test.ts
 *
 * Local runs use 250 cases; CI runs use 100 cases. A seed and path are passed
 * through unchanged to fast-check so the same minimized case can be replayed.
 */
export const fastCheckParameters = {
  endOnFailure: true,
  numRuns: process.env.CI === 'true' ? ciRunCount : localRunCount,
  ...optionalSeed(),
  ...optionalReplayPath(),
};

export { assert, fc };

function optionalInteger(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === '') return undefined;
  if (!/^-?\d+$/u.test(raw)) {
    throw new Error(`${name} must be an integer when provided`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} must be a safe integer when provided`);
  }
  return value;
}

function optionalPath(): string | undefined {
  const value = process.env.FAST_CHECK_PATH?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function optionalReplayPath(): Readonly<{ readonly path?: string }> {
  const path = optionalPath();
  return path === undefined ? {} : { path };
}

function optionalSeed(): Readonly<{ readonly seed?: number }> {
  const seed = optionalInteger('FAST_CHECK_SEED');
  return seed === undefined ? {} : { seed };
}
