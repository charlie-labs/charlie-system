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

export type AuthWhoamiResult = {
  status: 'ok';
  command: 'auth.whoami';
  identity: unknown;
};

const manifest = defineFlags({ token: CommonFlags.token() });

export default class AuthWhoamiCommand extends BaseCommand<
  CfgFlags<typeof manifest> | Result<AuthWhoamiResult> | Deps<SlackCommandDeps>
> {
  static override summary = 'Show the current Slack bot identity.';
  static override description =
    'Calls auth.test and prints the resolved team/user identity.';
  static override examples = ['$ <%= config.bin %> auth whoami --json'];
  static override flags = super.registerManifest(manifest);

  static override buildDeps(parsed: ParsedOf<typeof manifest>) {
    return buildSlackDeps(parsed);
  }

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<AuthWhoamiResult> {
    const { client } = requireDeps(deps);
    const identity = await client.whoAmI();
    return { status: 'ok', command: 'auth.whoami', identity };
  }
}
