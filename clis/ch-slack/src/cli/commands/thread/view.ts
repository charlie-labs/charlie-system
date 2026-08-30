import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type ParsedOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';

import { type SlackThreadPage } from '../../../lib/index.js';
import { buildSlackDeps, type SlackCommandDeps } from '../../utils/client.js';
import { CommonFlags } from '../../utils/flags.js';
import { requireDeps } from '../../utils/require-deps.js';

const manifest = defineFlags({
  token: CommonFlags.token(),
  channel: CommonFlags.channel(),
  ts: CommonFlags.ts(),
  cursor: CommonFlags.cursor(),
  limit: CommonFlags.limit(1000),
  inclusive: CommonFlags.inclusive(),
});

export type ThreadViewResult = {
  status: 'ok';
  command: 'thread.view';
  result: SlackThreadPage;
};

export default class ThreadViewCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<ThreadViewResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'View a Slack thread.';
  static override description = 'Wraps conversations.replies.';
  static override examples = [
    '$ <%= config.bin %> thread view -c general --ts 1726512000.000100 --json',
  ];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<ThreadViewResult> {
    const { client } = requireDeps(deps);
    const page = await client.viewThread({
      channel: parsed.channel,
      threadTs: parsed.ts,
      cursor: parsed.cursor,
      limit: parsed.limit,
      inclusive: parsed.inclusive,
    });

    return { status: 'ok', command: 'thread.view', result: page };
  }
}
