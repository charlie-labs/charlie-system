import { expect, mock, test } from 'bun:test';

import { noFlags } from '../src/flags/index.js';
import {
  BaseCommand,
  type CfgFlags,
  type ExecCtxOf,
  type Result,
} from '../src/index.js';

// Use exported helper to avoid duplication and drift

class LogCmd extends BaseCommand<CfgFlags<typeof noFlags> | Result<unknown>> {
  static override enableJsonFlag = true as const;
  static override get manifest() {
    return noFlags;
  }
  protected override async execute(_ctx: ExecCtxOf<this>): Promise<unknown> {
    this.logInfo('info');
    this.logWarn('warn');
    this.printRows([['a', 'b']], { header: ['h1', 'h2'] });
    return { ok: true };
  }
}

test('logs go to stderr, TSV to stdout when not in JSON mode', async () => {
  const cfg = {
    bin: 'test',
    userAgent: 'test-agent',
    runHook: async () => ({ successes: [], failures: [] }),
    scopedEnvVar: () => undefined,
  } as any;
  const cmd = new LogCmd([], cfg);
  const stderrSpy = mock<(s: unknown) => number>(() => 0);
  const stdoutSpy = mock<(s: unknown) => number>(() => 0);
  const origErr = process.stderr.write;
  const origOut = process.stdout.write;
  // @ts-ignore
  process.stderr.write = (s: any) => {
    stderrSpy(s);
    return true;
  };
  // @ts-ignore
  process.stdout.write = (s: any) => {
    stdoutSpy(s);
    return true;
  };

  await cmd.run();

  process.stderr.write = origErr;
  process.stdout.write = origOut;

  expect(stderrSpy.mock.calls.length > 0).toBeTrue();
  expect(stdoutSpy.mock.calls.length > 0).toBeTrue();
});
