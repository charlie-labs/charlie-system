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
import { z } from 'zod3';

import { buildSlackDeps, type SlackCommandDeps } from '../../utils/client.js';
import { CommonFlags } from '../../utils/flags.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  user: CommonFlags.user(),
  text: CommonFlags.text('Message text'),
  thread: {
    oclif: Flags.string({ description: 'Reply into thread ts if provided' }),
    schema: z
      .string()
      .optional()
      .pipe(
        z
          .string()
          .regex(
            /^\d+\.\d+$/,
            'Expected Slack timestamp like 1726519200.000300'
          )
          .optional()
      ),
  },
});

export type DmSendResult = {
  status: 'ok';
  command: 'dm.send';
  result: unknown;
};

export default class DmSendCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<DmSendResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'Send a direct message to a user.';
  static override description =
    'Opens a DM conversation if needed and posts the message.';
  static override examples = [
    '$ <%= config.bin %> dm send -u @alice -m "Hi" --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<DmSendResult> {
    const { client } = requireDeps(deps);
    const result = await client.sendDm({
      user: parsed.user,
      text: parsed.text,
      threadTs:
        parsed.thread && parsed.thread.trim() !== ''
          ? parsed.thread
          : undefined,
    });

    return { status: 'ok', command: 'dm.send', result };
  }
}
