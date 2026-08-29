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
import { ensureOldestBeforeLatest } from '../../utils/parse.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  channel: CommonFlags.channel(),
  cursor: CommonFlags.cursor(),
  limit: CommonFlags.limit(1000),
  oldest: {
    oclif: Flags.string({ description: 'Oldest ts to include' }),
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
  latest: {
    oclif: Flags.string({ description: 'Latest ts to include' }),
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
  inclusive: {
    oclif: Flags.boolean({ description: 'Include boundary timestamps' }),
    schema: z.boolean().optional(),
  },
});

export type ChannelHistoryResult = {
  status: 'ok';
  command: 'channel.history';
  channel: { id: string; name?: string | undefined };
  messages: readonly unknown[];
  page: { hasMore: boolean; nextCursor?: string | undefined };
};

export default class ChannelHistoryCommand extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Result<ChannelHistoryResult>
  | Deps<SlackCommandDeps>
> {
  static override summary = 'Fetch recent messages from a channel.';
  static override description =
    'Wraps conversations.history with optional time bounds and paging.';
  static override examples = [
    '$ <%= config.bin %> channel history -c general --limit 50 --json',
    '$ <%= config.bin %> channel history -c C0123 --oldest 1726512000.000000 --latest 1726519200.000000 --inclusive --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<ChannelHistoryResult> {
    // Validate ts ordering when both provided
    ensureOldestBeforeLatest({
      oldest: parsed.oldest,
      latest: parsed.latest,
    });

    const { client } = requireDeps(deps);

    const page = await client.getChannelHistory({
      channel: parsed.channel,
      cursor: parsed.cursor,
      limit: parsed.limit,
      oldest:
        parsed.oldest && parsed.oldest.trim() !== ''
          ? parsed.oldest
          : undefined,
      latest:
        parsed.latest && parsed.latest.trim() !== ''
          ? parsed.latest
          : undefined,
      inclusive: parsed.inclusive,
    });

    return {
      status: 'ok',
      command: 'channel.history',
      channel: { id: page.channel.id, name: page.channel.name },
      messages: page.messages,
      page: { hasMore: page.hasMore, nextCursor: page.nextCursor },
    };
  }
}
