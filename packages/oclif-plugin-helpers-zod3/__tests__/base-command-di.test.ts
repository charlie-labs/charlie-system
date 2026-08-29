import { expect, test } from 'bun:test';

import { Flags as CoreFlags } from '@oclif/core';

import { defineFlags, zString } from '../src/flags/index.js';
import {
  BaseCommand,
  type CfgFlags,
  type Deps,
  type ExecCtx,
  type ExecCtxOf,
  type Result,
} from '../src/index.js';

// Small helper to build the minimal oclif-like config used by tests
const mkCfg = () =>
  ({
    bin: 'test',
    userAgent: 'test-agent',
    runHook: async () => ({ successes: [], failures: [] }),
    scopedEnvVar: () => undefined,
  }) as any;

// 1) execute(ctx): no-op ctx (no flags/deps)
class NoArgsCmd extends BaseCommand<Result<number>> {
  protected override async execute(_ctx: ExecCtxOf<this>): Promise<number> {
    return 42;
  }
}

test('execute(_ctx) works (context not used)', async () => {
  const cmd = new NoArgsCmd([], mkCfg());
  const out = await cmd.run();
  expect(out).toBe(42);
});

// 2) execute(parsed)
const manifest = defineFlags({
  name: { oclif: CoreFlags.string({ required: true }), schema: zString() },
});

class ParsedOnlyCmd extends BaseCommand<
  CfgFlags<typeof manifest> | Result<string>
> {
  static override get manifest() {
    return manifest;
  }
  protected override async execute({
    parsed,
  }: ExecCtxOf<this>): Promise<string> {
    return parsed.name.toUpperCase();
  }
}

test('execute({ parsed }) passes typed flags', async () => {
  const cmd = new ParsedOnlyCmd(['--name=alice'], mkCfg());
  const out = await cmd.run();
  expect(out).toBe('ALICE');
});

// 3) execute({ deps }) where parsed is unused (deps-only in practice)
class DepsOnlyCmd extends BaseCommand<
  Deps<{ source: string }> | Result<string>
> {
  static override buildDeps(_parsed: Record<string, never>) {
    return { source: 'static' } as const;
  }
  protected override async execute({
    deps,
  }: ExecCtx<Deps<{ source: string }> | Result<string>>): Promise<string> {
    if (!deps) throw new Error('deps not provided');
    return deps.source;
  }
}

test('execute({ deps }) uses static buildDeps for deps-only', async () => {
  const cmd = new DepsOnlyCmd([], mkCfg());
  const out = await cmd.run();
  expect(out).toBe('static');
});

// 4) Precedence: test override → static buildDeps → instance getter
class DepsPrecedenceCmd extends BaseCommand<
  Deps<{ source: string }> | Result<string>
> {
  static override buildDeps(_parsed: Record<string, never>) {
    return { source: 'static' } as const;
  }
  protected override get deps() {
    return { source: 'instance' } as const;
  }
  protected override async execute({
    deps,
  }: ExecCtx<Deps<{ source: string }> | Result<string>>): Promise<string> {
    if (!deps) throw new Error('deps not provided');
    return deps.source;
  }
}

test('deps precedence: test > static > instance', async () => {
  // No override → static wins
  const cmd1 = new DepsPrecedenceCmd([], mkCfg());
  expect(await cmd1.run()).toBe('static');

  // Test override wins
  DepsPrecedenceCmd.setTestDeps({ source: 'test' });
  const cmd2 = new DepsPrecedenceCmd([], mkCfg());
  expect(await cmd2.run()).toBe('test');

  // One-shot consumption: subsequent run without re-setting uses static again
  const cmd3 = new DepsPrecedenceCmd([], mkCfg());
  expect(await cmd3.run()).toBe('static');
});

// 5) Fallback to instance deps when static buildDeps returns undefined
class DepsFallbackCmd extends BaseCommand<
  Deps<{ source: string }> | Result<string>
> {
  static override buildDeps(_parsed: Record<string, never>) {
    return undefined;
  }
  protected override get deps() {
    return { source: 'instance' } as const;
  }
  protected override async execute({
    deps,
  }: ExecCtx<Deps<{ source: string }> | Result<string>>): Promise<string> {
    if (!deps) throw new Error('deps not provided');
    return deps.source;
  }
}
test('deps fallback to instance when static returns undefined', async () => {
  const cmd = new DepsFallbackCmd([], mkCfg());
  expect(await cmd.run()).toBe('instance');
});

// 6) Duplicate-tag detection: intentionally not enforced at compile time in this version.
