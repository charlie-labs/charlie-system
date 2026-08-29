import { expect, test } from 'bun:test';

import { Flags } from '@oclif/core';

import {
  defineFlags,
  type ParsedOf,
  zDateYYYYMMDD,
  zMultiEnum,
  zOrderDir,
  zPositiveInt,
} from '../src/flags/index.js';
import {
  BaseCommand,
  type CfgFlags,
  type ExecCtx,
  type Result,
} from '../src/index.js';

// Build a manifest and use it as the oclif flags for a Command subclass
const statusValues = ['started', 'completed', 'error'] as const;
const manifest = defineFlags({
  start: { oclif: Flags.string(), schema: zDateYYYYMMDD.optional() },
  end: { oclif: Flags.string(), schema: zDateYYYYMMDD.optional() },
  limit: {
    oclif: Flags.integer({ default: 100 }),
    schema: zPositiveInt({ default: 100, max: 10_000 }),
  },
  order: {
    oclif: Flags.option({ options: ['asc', 'desc'] as const })(),
    schema: zOrderDir.optional(),
  },
  status: {
    oclif: Flags.option({
      options: statusValues,
      multiple: true,
      delimiter: ',',
    })(),
    schema: zMultiEnum(statusValues),
  },
});

type ParsedFlags = ParsedOf<typeof manifest>;

class DemoFlagsCmd extends BaseCommand<
  CfgFlags<typeof manifest> | Result<ParsedFlags>
> {
  static override get manifest() {
    return manifest;
  }

  protected override async execute({
    parsed,
  }: ExecCtx<CfgFlags<typeof manifest> | Result<ParsedFlags>>) {
    return parsed;
  }
}

// Small helper to build the minimal oclif-like config used by tests
const mkCfg = () =>
  ({
    bin: 'test',
    userAgent: 'test-agent',
    runHook: async () => ({ successes: [], failures: [] }),
    scopedEnvVar: () => undefined,
  }) as any;

// Small helper to run the command with argv and return parsed flags
async function run(argv: readonly string[]): Promise<ParsedFlags> {
  const cmd = new DemoFlagsCmd([...argv], mkCfg());
  return await cmd.run();
}

test('parseFromCommand: parses flags via oclif then Zod', async () => {
  const argv = [
    '--start=2025-01-01',
    '--end=2025-01-02',
    '--limit',
    '250',
    '--order=desc',
    '--status=started,completed',
  ];
  const parsed = await run(argv);

  expect(
    parsed.start?.toISOString().startsWith('2025-01-01T00:00:00.000Z')
  ).toBeTrue();
  expect(
    parsed.end?.toISOString().startsWith('2025-01-02T00:00:00.000Z')
  ).toBeTrue();
  expect(parsed.limit).toBe(250);
  expect(parsed.order).toBe('desc');
  expect(parsed.status).toEqual(['started', 'completed']);
});

test('parseFromCommand: uses default for limit and accepts empty status', async () => {
  const parsed = await run(['--start=2025-01-01']);

  expect(parsed.limit).toBe(100);
  expect(parsed.status).toEqual([]);
  expect(Object.keys(parsed)).toEqual(['start', 'limit', 'status']);
  expect(Object.hasOwn(parsed, 'start')).toBeTrue();
  expect(Object.hasOwn(parsed, 'end')).toBeFalse();
  expect(Object.hasOwn(parsed, 'limit')).toBeTrue();
  expect(Object.hasOwn(parsed, 'order')).toBeFalse();
  expect(Object.hasOwn(parsed, 'status')).toBeTrue();
});

test('parseFromCommand: flexible on multi-argument parsing', async () => {
  const argv = ['--status=started,completed', '--status=error'];
  const parsed = await run(argv);

  expect(parsed.status).toEqual(['started', 'completed', 'error']);
});
