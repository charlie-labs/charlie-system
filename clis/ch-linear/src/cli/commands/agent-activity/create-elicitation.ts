import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type AgentActivityCreateInput,
  type AgentActivityCreateMutation,
  AgentActivitySignal,
  AgentActivityType,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import {
  ApiRequestError,
  getErrorMessage,
  ValidationError,
} from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createAgentActivity } from '../../../lib/operations/agent-activity/create.js';
import { AGENT_ACTIVITY_JSON_SHAPE_WRAPPED } from '../../utils/agent-activity-docs.js';
import {
  AGENT_ACTIVITY_TSV_HEADER,
  agentActivityToTsv,
} from '../../utils/agent-activity.js';
import { readJsonOrFile, readTextOrFile } from '../../utils/flags/file.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { isRecord } from '../../utils/type-guards.js';

const manifest = defineFlags({
  session: {
    oclif: Flags.string({
      description: 'Agent session id (UUID)',
      required: true,
    }),
    schema: z.string().trim().min(1),
  },
  signal: {
    oclif: Flags.string({
      description: 'Signal modifier. One of auth|select|stop|continue',
      options: Object.values(AgentActivitySignal),
      required: true,
    }),
    schema: z.nativeEnum(AgentActivitySignal),
  },
  'signal-metadata-json': {
    oclif: Flags.string({
      description: 'Optional JSON value or @file.json with signal metadata',
    }),
    schema: z.string().optional(),
  },
  body: {
    oclif: Flags.string({
      description:
        'Optional body value or @file.md for the elicitation content',
    }),
    schema: z.string().optional(),
  },
  ephemeral: {
    oclif: Flags.boolean({
      description: 'Mark the activity as ephemeral',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  'activity-id': {
    oclif: Flags.string({
      description:
        'Optional stable activity id for update-in-place patterns (passed as input.id)',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

type AgentActivityCreatePayload = NonNullable<
  AgentActivityCreateMutation['agentActivityCreate']
>;
type AgentActivityResult = NonNullable<
  AgentActivityCreatePayload['agentActivity']
>;

export default class AgentActivityCreateElicitation extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'AgentActivityCreate'>>
  | Result<{ agentActivity: AgentActivityResult }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Create an elicitation activity within an agent session.',
    '',
    'Output',
    '- TSV columns (in order): id, type, signal, ephemeral, createdAt, updatedAt, snippet',
    '- JSON shape:',
    ...AGENT_ACTIVITY_JSON_SHAPE_WRAPPED,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --signal auth --signal-metadata-json @metadata.json --json',
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --signal select --body "Pick one"',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ agentActivity: AgentActivityResult }> {
    let body = '';
    if (parsed.body) {
      try {
        body = await readTextOrFile(parsed.body);
      } catch (err) {
        throw new ValidationError(getErrorMessage(err));
      }
    }

    body = await formatForLinearString(body);

    let signalMetadata: AgentActivityCreateInput['signalMetadata'];
    if (parsed['signal-metadata-json']) {
      let raw: unknown;
      try {
        raw = await readJsonOrFile(parsed['signal-metadata-json']);
      } catch (err) {
        throw new ValidationError(getErrorMessage(err));
      }

      if (raw !== null && !isRecord(raw)) {
        throw new ValidationError(
          '--signal-metadata-json must be an object or null.'
        );
      }

      signalMetadata = raw;
    }

    const input: AgentActivityCreateInput = {
      agentSessionId: parsed.session,
      content: {
        type: AgentActivityType.Elicitation,
        body,
      },
      signal: parsed.signal,
      ...(signalMetadata !== undefined ? { signalMetadata } : {}),
      ...(parsed.ephemeral ? { ephemeral: true } : {}),
      ...(parsed['activity-id'] ? { id: parsed['activity-id'] } : {}),
    };

    const { client } = resolveDeps<Pick<Sdk, 'AgentActivityCreate'>>(
      deps,
      getLinearSdk
    );

    const payload = await createAgentActivity({ input }, { client });
    const agentActivity = payload.agentActivity;
    if (!agentActivity) {
      throw new ApiRequestError(
        'Unexpected empty agent activity returned from Linear.'
      );
    }
    this.printRows([agentActivityToTsv(agentActivity)], {
      header: AGENT_ACTIVITY_TSV_HEADER,
    });
    return { agentActivity };
  }
}
