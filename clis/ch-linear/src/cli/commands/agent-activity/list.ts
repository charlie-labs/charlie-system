import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
  zPositiveInt,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type GetAgentActivitiesQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listAgentActivities } from '../../../lib/operations/agent-activity/list.js';
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/default-page-size.js';
import { AGENT_ACTIVITY_CONNECTION_JSON_SHAPE } from '../../utils/agent-activity-docs.js';
import {
  AGENT_ACTIVITY_TSV_HEADER,
  agentActivityToTsv,
} from '../../utils/agent-activity.js';

type AgentActivityConnection = NonNullable<
  GetAgentActivitiesQuery['agentActivities']
>;

const manifest = defineFlags({
  session: {
    oclif: Flags.string({
      description: 'Agent session id (UUID)',
      required: true,
    }),
    schema: z.string().trim().min(1),
  },
  first: {
    oclif: Flags.integer({
      description: `Number of activities to fetch per request (default ${DEFAULT_PAGE_SIZE})`,
      default: DEFAULT_PAGE_SIZE,
      min: 1,
    }),
    schema: zPositiveInt({ default: DEFAULT_PAGE_SIZE }),
  },
  after: {
    oclif: Flags.string({
      description: 'Pagination cursor (applied to the first request only)',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

export default class AgentActivityList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetAgentActivities'>>
  | Result<AgentActivityConnection>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'List agent activities for an agent session.',
    '',
    'Output',
    '- TSV columns (in order): id, type, signal, ephemeral, createdAt, updatedAt, snippet',
    '- JSON shape:',
    ...AGENT_ACTIVITY_CONNECTION_JSON_SHAPE,
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> --session <agentSessionId>',
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --first 20 --json',
    '<%= config.bin %> <%= command.id %> --session <agentSessionId> --after <cursor> --json',
  ];

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<AgentActivityConnection> {
    const filter = { agentSessionId: { eq: parsed.session } };
    const { client } = resolveDeps<Pick<Sdk, 'GetAgentActivities'>>(
      deps,
      getLinearSdk
    );

    const connection = await listAgentActivities(
      { filter, first: parsed.first, after: parsed.after },
      { client }
    );
    this.printRows(connection.nodes.map(agentActivityToTsv), {
      header: AGENT_ACTIVITY_TSV_HEADER,
    });
    return connection;
  }
}
