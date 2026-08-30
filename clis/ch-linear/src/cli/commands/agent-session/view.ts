import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import {
  type GetAgentSessionQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { getAgentSession } from '../../../lib/operations/agent-session/get.js';
import { AGENT_SESSION_JSON_SHAPE } from '../../utils/agent-session-docs.js';
import {
  AGENT_SESSION_TSV_HEADER,
  agentSessionToTsv,
} from '../../utils/agent-session.js';

type AgentSessionDetails = NonNullable<GetAgentSessionQuery['agentSession']>;

export default class AgentSessionView extends BaseCommand<
  Deps<LinearDeps<'GetAgentSession'>> | Result<AgentSessionDetails>
> {
  static description = [
    'Fetch an agent session by id.',
    '',
    'Output',
    '- TSV columns (in order): id, status, type, issueIdentifier, commentId, createdAt, updatedAt',
    '- JSON shape:',
    ...AGENT_SESSION_JSON_SHAPE,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> <agentSessionId>',
    '<%= config.bin %> <%= command.id %> <agentSessionId> --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Agent session id (UUID)',
    }),
  } as const;

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<AgentSessionDetails> {
    const { args } = await this.parse(AgentSessionView);
    const { client } = resolveDeps<Pick<Sdk, 'GetAgentSession'>>(
      deps,
      getLinearSdk
    );

    const session = await getAgentSession({ id: args.id }, { client });
    this.printRows([agentSessionToTsv(session)], {
      header: AGENT_SESSION_TSV_HEADER,
    });
    return session;
  }
}
