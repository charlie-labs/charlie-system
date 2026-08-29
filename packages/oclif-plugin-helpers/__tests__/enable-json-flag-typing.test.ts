import { expect, test } from 'bun:test';

import { noFlags } from '../src/flags/index.js';
import {
  BaseCommand,
  type CfgFlags,
  type ExecCtxOf,
  type Result,
} from '../src/index.js';

// A command that explicitly disables the JSON flag
class NoJsonCmd extends BaseCommand<
  CfgFlags<typeof noFlags> | Result<{ ok: true }>
> {
  static override enableJsonFlag = false as const;
  static override get manifest() {
    return noFlags;
  }
  protected override async execute(_ctx: ExecCtxOf<this>) {
    return { ok: true } as const;
  }
}

test('BaseCommand.enableJsonFlag is a boolean (subclasses may set false)', () => {
  // Compile-time check: this assignment will fail if the base type is literal `true`.
  const _ensureBoolean: boolean = NoJsonCmd.enableJsonFlag;
  expect(_ensureBoolean).toBeFalse();
});

test('when JSON is disabled, `--json` is not accepted', async () => {
  const cfg = {
    bin: 'test',
    userAgent: 'test-agent',
    runHook: async () => ({ successes: [], failures: [] }),
    scopedEnvVar: () => undefined,
  } as any;

  // Passing --json should cause oclif parsing to error since the flag is disabled.
  const cmd = new NoJsonCmd(['--json'], cfg);
  await expect(cmd.run()).rejects.toThrow();
});
