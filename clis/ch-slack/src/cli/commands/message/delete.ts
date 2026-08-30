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
});

export type MessageDeleteResult = {
  status: 'ok';
  command: 'message.delete';
  channel: string;
  ts: string;
  result: { channel: string; ts: string };
};

export default class MessageDeleteCommand extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Result<MessageDeleteResult>
  | Deps<SlackCommandDeps>
> {
  static override summary = 'Delete a message by timestamp.';
  static override description = 'Wraps chat.delete.';
  static override examples = [
    '$ <%= config.bin %> message delete -c general --ts 1726519200.000300 --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<MessageDeleteResult> {
    const { client } = requireDeps(deps);
    const result = await client.deleteMessage({
      channel: parsed.channel,
      ts: parsed.ts,
    });
    return {
      status: 'ok',
      command: 'message.delete',
      channel: parsed.channel,
      ts: parsed.ts,
      result,
    };
  }
}
