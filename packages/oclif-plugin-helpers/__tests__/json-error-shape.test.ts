import { expect, test } from 'bun:test';

import { noFlags } from '../src/flags/index.js';
import {
  BaseCommand,
  type CfgFlags,
  type ExecCtxOf,
  type Result,
  ValidationError,
} from '../src/index.js';

// Use exported helper to avoid duplication and drift

class DemoCmd extends BaseCommand<CfgFlags<typeof noFlags> | Result<unknown>> {
  static override enableJsonFlag = true as const;
  static override get manifest() {
    return noFlags;
  }
  protected override async execute(_ctx: ExecCtxOf<this>): Promise<unknown> {
    throw new ValidationError('Invalid input.');
  }

  public exposeToErrorJson(err: unknown) {
    // Access protected method for testing
    // @ts-ignore - calling protected within subclass context via wrapper
    return this.toErrorJson(err);
  }
}

test('toErrorJson returns minimal stable shape', async () => {
  const cmd = new DemoCmd([], {} as any);
  const json = cmd.exposeToErrorJson(new ValidationError('Invalid input.'));
  expect(json.error.type).toBe('ValidationError');
  expect(json.error.message).toBe('Invalid input.');
  expect(json.error.exitCode).toBe(2);
});
