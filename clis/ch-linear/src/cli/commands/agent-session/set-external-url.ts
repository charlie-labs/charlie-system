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
  type AgentSessionUpdateExternalUrlMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ApiRequestError, ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { updateAgentSessionExternalUrl } from '../../../lib/operations/agent-session/update-external-url.js';
import { AGENT_SESSION_JSON_SHAPE_WRAPPED } from '../../utils/agent-session-docs.js';
import {
  AGENT_SESSION_TSV_HEADER,
  agentSessionToTsv,
} from '../../utils/agent-session.js';
import { isValidExternalUrl } from '../../utils/url.js';

const manifest = defineFlags({
  url: {
    oclif: Flags.string({
      description:
        'Customer-accessible http(s):// URL to associate with the session',
      required: true,
    }),
    schema: z.string().trim().min(1),
  },
  label: {
    oclif: Flags.string({
      description: 'Optional label for the URL',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

type AgentSessionUpdateExternalUrlPayload = NonNullable<
  AgentSessionUpdateExternalUrlMutation['agentSessionUpdateExternalUrl']
>;
type AgentSessionResult = NonNullable<
  AgentSessionUpdateExternalUrlPayload['agentSession']
>;

export default class AgentSessionSetExternalUrl extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'AgentSessionUpdateExternalUrl'>>
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
    'Add an external URL entry to an agent session.',
    '',
    'Output',
    '- TSV columns (in order): id, status, type, issueIdentifier, commentId, createdAt, updatedAt',
    '- JSON shape:',
    ...AGENT_SESSION_JSON_SHAPE_WRAPPED,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> <agentSessionId> --url https://example.com',
    '<%= config.bin %> <%= command.id %> <agentSessionId> --url https://example.com --label "Run log" --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ agentSession: AgentSessionResult }> {
    const { args } = await this.parse(AgentSessionSetExternalUrl);

    const url = parsed.url.trim();
    const label = parsed.label?.trim();
    if (!isValidExternalUrl(url)) {
      throw new ValidationError(
        '--url must be a customer-accessible http(s):// URL.'
      );
    }

    const { client } = resolveDeps<Pick<Sdk, 'AgentSessionUpdateExternalUrl'>>(
      deps,
      getLinearSdk
    );

    const payload = await updateAgentSessionExternalUrl(
      {
        id: args.id,
        input: {
          addedExternalUrls: [
            {
              url,
              // `label` is required by Linear's `AgentSessionExternalUrlInput`
              label: label ?? url,
            },
          ],
        },
      },
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
