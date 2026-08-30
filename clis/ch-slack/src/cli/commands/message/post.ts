import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';

import { buildSlackDeps, type SlackCommandDeps } from '../../utils/client.js';
import { CommonFlags } from '../../utils/flags.js';
import { SlackTsSchema } from '../../utils/parse.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  channel: CommonFlags.channel(),
  text: CommonFlags.text('Message text'),
  thread: {
    oclif: Flags.string({
      description: 'Post as a reply in the given thread ts',
    }),
    schema: SlackTsSchema.optional(),
  },
  joinFirst: CommonFlags.joinFirst(),
});

export type MessagePostResult = {
  status: 'ok';
  command: 'message.post';
  result: unknown;
};

export default class MessagePostCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<MessagePostResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'Post a message to a channel.';
  static override description =
    'Wraps chat.postMessage with optional join-first and thread reply.';
  static override examples = [
    '$ <%= config.bin %> message post -c general -m "Hello" --json',
    '$ <%= config.bin %> message post -c C0123 --thread 1726519200.000300 -m "Reply" --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<MessagePostResult> {
    const { client } = requireDeps(deps);
    const result = await client.postMessage({
      channel: parsed.channel,
      text: parsed.text,
      threadTs: parsed.thread ?? undefined,
      joinIfNeeded: parsed.joinFirst,
    });

    return { status: 'ok', command: 'message.post', result };
  }
}
