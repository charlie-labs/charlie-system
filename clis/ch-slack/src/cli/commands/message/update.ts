import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';

import { type SlackMessage } from '../../../lib/index.js';
import { buildSlackDeps, type SlackCommandDeps } from '../../utils/client.js';
import { CommonFlags } from '../../utils/flags.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  channel: CommonFlags.channel(),
  ts: CommonFlags.ts(),
  text: CommonFlags.text('Replacement text'),
});

export type MessageUpdateResult = {
  status: 'ok';
  command: 'message.update';
  result: SlackMessage;
};

export default class MessageUpdateCommand extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Result<MessageUpdateResult>
  | Deps<SlackCommandDeps>
> {
  static override summary = 'Update a message by timestamp.';
  static override description = 'Wraps chat.update.';
  static override examples = [
    '$ <%= config.bin %> message update -c general --ts 1726519200.000300 -m "Edited" --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<MessageUpdateResult> {
    const { client } = requireDeps(deps);
    const message = await client.updateMessage({
      channel: parsed.channel,
      ts: parsed.ts,
      text: parsed.text,
    });

    return { status: 'ok', command: 'message.update', result: message };
  }
}
