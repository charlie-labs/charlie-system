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
  type: {
    oclif: Flags.string({
      description:
        'Activity type. One of thought|action|response|error|elicitation|prompt',
      options: Object.values(AgentActivityType),
      required: true,
    }),
    schema: z.nativeEnum(AgentActivityType),
  },
  body: {
    oclif: Flags.string({
      description:
        'Text value or @file.md. Mutually exclusive with --content-json.',
    }),
    schema: z.string().optional(),
  },
  'content-json': {
    oclif: Flags.string({
      description:
        'JSON value or @file.json. Mutually exclusive with --body. Must include a "type" field matching --type.',
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

function requireNonEmptyString(value: unknown, field: string): string | never {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireString(value: unknown, field: string): string | never {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`);
  }
  return value;
}

function requireStringOrNull(
  value: unknown,
  field: string
): string | null | never {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new ValidationError(`${field} must be a string or null`);
}

export default class AgentActivityCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'AgentActivityCreate'>>
  | Result<{ agentActivity: AgentActivityResult }>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'Create a Linear agent activity within an agent session.',
    '',
    'Output',
    '- TSV columns (in order): id, type, signal, ephemeral, createdAt, updatedAt, snippet',
    '- JSON shape:',
    ...AGENT_ACTIVITY_JSON_SHAPE_WRAPPED,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --type thought --body "Investigating"',
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --type response --body @response.md --json',
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --type action --content-json @content.json --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<{ agentActivity: AgentActivityResult }> {
    if (parsed.body && parsed['content-json']) {
      throw new ValidationError('Use --body or --content-json, not both.');
    }
    if (!parsed.body && !parsed['content-json']) {
      throw new ValidationError('Provide --body or --content-json.');
    }

    let content: Record<string, unknown>;

    if (parsed['content-json']) {
      let raw: unknown;
      try {
        raw = await readJsonOrFile(parsed['content-json']);
      } catch (err) {
        throw new ValidationError(getErrorMessage(err));
      }

      if (!isRecord(raw)) {
        throw new ValidationError('--content-json must be a JSON object.');
      }

      const contentType = requireNonEmptyString(raw['type'], 'content.type');
      if (contentType !== String(parsed.type)) {
        throw new ValidationError('content.type must match --type');
      }

      if (parsed.type === AgentActivityType.Action) {
        const action = requireNonEmptyString(raw['action'], 'content.action');

        let parameter: string | undefined;
        if ('parameter' in raw) {
          parameter = requireString(raw['parameter'], 'content.parameter');
        }

        const hasResult = 'result' in raw;
        const result: string | null | undefined = hasResult
          ? requireStringOrNull(raw['result'], 'content.result')
          : undefined;

        let formattedResult: string | null | undefined = result;
        if (hasResult && result !== null && result !== undefined) {
          formattedResult = await formatForLinearString(result);
        }

        content = {
          ...raw,
          action: await formatForLinearString(action),
          ...(parameter !== undefined
            ? { parameter: await formatForLinearString(parameter) }
            : {}),
          ...(hasResult ? { result: formattedResult } : {}),
        };
      } else {
        const body = requireString(raw['body'], 'content.body');
        content = { ...raw, body: await formatForLinearString(body) };
      }
    } else {
      const bodyRaw = parsed.body;
      if (!bodyRaw) {
        throw new ValidationError('Provide --body or --content-json.');
      }

      let body: string;
      try {
        body = await readTextOrFile(bodyRaw);
      } catch (err) {
        throw new ValidationError(getErrorMessage(err));
      }

      if (
        parsed.type === AgentActivityType.Action &&
        body.trim().length === 0
      ) {
        throw new ValidationError(
          'For --type action, --body must include at least one non-whitespace character.'
        );
      }

      body = await formatForLinearString(body);

      content =
        parsed.type === AgentActivityType.Action
          ? { type: AgentActivityType.Action, action: body }
          : { type: parsed.type, body };
    }

    const input: AgentActivityCreateInput = {
      agentSessionId: parsed.session,
      content,
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
