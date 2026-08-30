import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';

import { buildSlackDeps, type SlackCommandDeps } from '../../utils/client.js';
import { CommonFlags } from '../../utils/flags.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  channel: CommonFlags.channel(),
  ts: CommonFlags.ts(),
  emoji: CommonFlags.emoji(),
});

export type ReactRemoveResult = {
  status: 'ok';
  command: 'react.remove';
  channel: string;
  ts: string;
  emoji: string;
};

export default class ReactRemoveCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<ReactRemoveResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'Remove a reaction from a message.';
  static override description = 'Wraps reactions.remove.';
  static override examples = [
    '$ <%= config.bin %> react remove -c general --ts 1726519200.000300 -e eyes --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<ReactRemoveResult> {
    const { client } = requireDeps(deps);
    await client.removeReaction({
      name: parsed.emoji,
      channel: parsed.channel,
      timestamp: parsed.ts,
    });
    return {
      status: 'ok',
      command: 'react.remove',
      channel: parsed.channel,
      ts: parsed.ts,
      emoji: parsed.emoji,
    };
  }
}
