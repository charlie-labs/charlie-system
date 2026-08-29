import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type AgentSessionUpdateMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import {
  ApiRequestError,
  getErrorMessage,
  ValidationError,
} from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { setAgentSessionPlan } from '../../../lib/operations/agent-session/set-plan.js';
import { AGENT_SESSION_JSON_SHAPE_WRAPPED } from '../../utils/agent-session-docs.js';
import {
  AGENT_SESSION_TSV_HEADER,
  agentSessionToTsv,
} from '../../utils/agent-session.js';
import { readJsonOrFile } from '../../utils/flags/file.js';

const manifest = defineFlags({
  'plan-json': {
    oclif: Flags.string({
      description: 'JSON value or @file.json used to set the session plan',
      required: true,
    }),
    schema: z.string().trim().min(1),
  },
} as const);

type AgentSessionUpdatePayload = NonNullable<
  AgentSessionUpdateMutation['agentSessionUpdate']
>;
type AgentSessionResult = NonNullable<
  AgentSessionUpdatePayload['agentSession']
>;

export default class AgentSessionSetPlan extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'AgentSessionUpdate'>>
  | Result<{ agentSession: AgentSessionResult }>
> {
  static override flags = super.registerManifest(manifest);

  static args = {
    id: Args.string({
      required: true,
      description: 'Agent session id (UUID)',
    }),
  } as const;

  static description = [
    'Set the plan for an agent session.',
    '',
    'Output',
    '- TSV columns (in order): id, status, type, issueIdentifier, commentId, createdAt, updatedAt',
    '- JSON shape:',
    ...AGENT_SESSION_JSON_SHAPE_WRAPPED,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> <agentSessionId> --plan-json @plan.json',
    '<%= config.bin %> <%= command.id %> <agentSessionId> --plan-json @plan.json --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ agentSession: AgentSessionResult }> {
    const { args } = await this.parse(AgentSessionSetPlan);
    const { client } = resolveDeps<Pick<Sdk, 'AgentSessionUpdate'>>(
      deps,
      getLinearSdk
    );

    let plan: unknown;
    try {
      plan = await readJsonOrFile(parsed['plan-json']);
    } catch (err) {
      throw new ValidationError(getErrorMessage(err));
    }

    const payload = await setAgentSessionPlan(
      { id: args.id, plan },
      { client }
    );
    const agentSession = payload.agentSession;
    if (!agentSession) {
      throw new ApiRequestError(
        'Unexpected empty agent session returned from Linear.'
      );
    }
    this.printRows([agentSessionToTsv(agentSession)], {
      header: AGENT_SESSION_TSV_HEADER,
    });
    return { agentSession };
  }
}
