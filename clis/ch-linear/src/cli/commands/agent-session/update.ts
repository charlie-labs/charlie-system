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
import { updateAgentSession } from '../../../lib/operations/agent-session/update.js';
import { AGENT_SESSION_JSON_SHAPE_WRAPPED } from '../../utils/agent-session-docs.js';
import {
  AGENT_SESSION_TSV_HEADER,
  agentSessionToTsv,
} from '../../utils/agent-session.js';
import { readJsonOrFile, readTextOrFile } from '../../utils/flags/file.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { isRecord } from '../../utils/type-guards.js';

const manifest = defineFlags({
  'plan-json': {
    oclif: Flags.string({
      description: 'JSON value or @file.json used to update the session plan',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  summary: {
    oclif: Flags.string({
      description:
        'Optional summary metadata (string or @file.md). Stored within the plan JSON under key "summary".',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  'prompt-context-json': {
    oclif: Flags.string({
      description:
        'Optional prompt context metadata (JSON or @file.json). Stored within the plan JSON under key "promptContext".',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

type AgentSessionUpdatePayload = NonNullable<
  AgentSessionUpdateMutation['agentSessionUpdate']
>;
type AgentSessionResult = NonNullable<
  AgentSessionUpdatePayload['agentSession']
>;

export default class AgentSessionUpdate extends BaseCommand<
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
    'Update a Linear agent session plan metadata.',
    '',
    'Output',
    '- TSV columns (in order): id, status, type, issueIdentifier, commentId, createdAt, updatedAt',
    '- JSON shape:',
    ...AGENT_SESSION_JSON_SHAPE_WRAPPED,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> <agentSessionId> --plan-json @plan.json',
    '<%= config.bin %> <%= command.id %> <agentSessionId> --plan-json @plan.json --json',
    '<%= config.bin %> <%= command.id %> <agentSessionId> --summary @summary.md --prompt-context-json @prompt-context.json --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ agentSession: AgentSessionResult }> {
    const { args } = await this.parse(AgentSessionUpdate);

    const hasAnyUpdate =
      Boolean(parsed['plan-json']) ||
      Boolean(parsed.summary) ||
      Boolean(parsed['prompt-context-json']);
    if (!hasAnyUpdate) {
      throw new ValidationError(
        'No update provided. Set at least one of: --plan-json, --summary, --prompt-context-json.'
      );
    }

    let plan: unknown | undefined;
    let summary: string | undefined;
    let promptContext: unknown | undefined;

    try {
      if (parsed['plan-json']) {
        plan = await readJsonOrFile(parsed['plan-json']);
      }
      if (parsed.summary) {
        summary = await readTextOrFile(parsed.summary);
        summary = await formatForLinearString(summary);
      }
      if (parsed['prompt-context-json']) {
        promptContext = await readJsonOrFile(parsed['prompt-context-json']);
      }
    } catch (err) {
      throw new ValidationError(getErrorMessage(err));
    }

    if (plan === undefined && (summary || promptContext !== undefined)) {
      plan = {};
    }

    if ((summary || promptContext !== undefined) && !isRecord(plan)) {
      throw new ValidationError(
        'When using --summary or --prompt-context-json, the effective plan value must be a JSON object.'
      );
    }

    if (isRecord(plan) && (summary || promptContext !== undefined)) {
      const nextPlan = { ...plan };
      if (summary) {
        nextPlan['summary'] = summary;
      }
      if (promptContext !== undefined) {
        nextPlan['promptContext'] = promptContext;
      }
      plan = nextPlan;
    }

    const { client } = resolveDeps<Pick<Sdk, 'AgentSessionUpdate'>>(
      deps,
      getLinearSdk
    );

    const payload = await updateAgentSession(
      {
        id: args.id,
        input: {
          ...(plan !== undefined ? { plan } : {}),
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
