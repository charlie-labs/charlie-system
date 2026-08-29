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
import { parseCsv } from '../../utils/parse.js';
import { requireDeps } from '../../utils/require-deps.js';

export type ChannelListResult = {
  status: 'ok';
  command: 'channel.list';
  channels: readonly unknown[];
};

const manifest = defineFlags({
  token: CommonFlags.token(),
  types: CommonFlags.types(),
  limit: CommonFlags.limit(1000),
});

export default class ChannelListCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<ChannelListResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'List available Slack channels.';
  static override description =
    'Fetches conversations.list with optional types and limit.';
  static override examples = [
    '$ <%= config.bin %> channel list --types public_channel,private_channel --limit 50 --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<ChannelListResult> {
    const { client } = requireDeps(deps);
    const channels = await client.listChannels({
      types: parseCsv(parsed.types),
      limit: parsed.limit,
    });
    return { status: 'ok', command: 'channel.list', channels };
  }
}
