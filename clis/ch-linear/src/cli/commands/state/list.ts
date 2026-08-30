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
  type GetWorkflowStatesQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ValidationError as LibValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listWorkflowStates } from '../../../lib/operations/workflow-state/list-workflow-states.js';

type WorkflowStateNode = NonNullable<
  GetWorkflowStatesQuery['workflowStates']['nodes'][number]
>;

const ALLOWED_TYPES = [
  'completed',
  'started',
  'triage',
  'unstarted',
  'canceled',
  'backlog',
] as const;

const ALLOWED_TYPE_SET = new Set<string>(ALLOWED_TYPES);

const manifest = defineFlags({
  type: {
    // Multi-value filter: supports repeat or comma-separated values
    oclif: Flags.string({
      description: `Filter by workflow state type (repeat or comma-separated). Allowed values: ${ALLOWED_TYPES.join(', ')}`,
      multiple: true,
      delimiter: ',',
      // Normalise case/whitespace
      parse: async (v) => v.trim().toLowerCase(),
    }),
    // Intentionally permissive: we validate values at runtime in `execute()` to
    // preserve exit‑code semantics (usage → 2) under the framework base.
    schema: z.array(z.string()).optional(),
  },
  limit: {
    oclif: Flags.integer({
      description: 'Maximum number of states to list (default 50)',
      default: 50,
      min: 1,
    }),
    schema: zPositiveInt({ default: 50 }),
  },
} as const);

/**
 * List workflow states in the workspace.
 *
 * Each state is printed on its own line (TSV):
 *
 *   <id>\t<name>\t<type>\t<position>\t<team name>
 */
export default class StateList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetWorkflowStates'>>
  | Result<WorkflowStateNode[]>
> {
  static override flags = super.registerManifest(manifest);

  static description = [
    'List workflow states.',
    '',
    'Filters',
    '- Use --type to restrict results by workflow state type. Allowed values:',
    '  completed, started, triage, unstarted, canceled, backlog.',
    '',
    'Output',
    '- TSV columns (in order): id, name, type, position, team',
    '- JSON shape:',
    '```ts',
    'type WorkflowState = {',
    '  id: uuid;',
    '  name: string;',
    '  type: string;',
    '  position: number | null;',
    '  color: string | null;',
    '  team: { id: uuid; name: string } | null;',
    '};',
    '// Output: WorkflowState[]',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --type completed --type started',
    '<%= config.bin %> <%= command.id %> --type "completed,started" --limit 5 --json',
  ];

  protected async execute(ctx: ExecCtxOf<this>): Promise<WorkflowStateNode[]> {
    const { client, cache } = resolveDeps<Pick<Sdk, 'GetWorkflowStates'>>(
      ctx.deps,
      getLinearSdk
    );

    // Validate type values explicitly to preserve exit code semantics (usage → 2)
    const parsedTypes =
      ctx.parsed.type && ctx.parsed.type.length ? ctx.parsed.type : undefined;
    if (parsedTypes) {
      for (const t of parsedTypes) {
        if (!ALLOWED_TYPE_SET.has(t)) {
          throw new LibValidationError(
            `Invalid --type value: ${JSON.stringify(t)}. Allowed values: ${ALLOWED_TYPES.join(', ')}`
          );
        }
      }
    }

    const states = await listWorkflowStates(
      {
        types: parsedTypes,
        limit: ctx.parsed.limit,
      },
      { client, cache }
    );

    this.printRows(
      states.map((state) => {
        const formattedPosition =
          state.position === undefined ||
          state.position === null ||
          Number.isNaN(state.position)
            ? ''
            : Math.round(state.position).toString();
        return [
          state.id,
          state.name,
          state.type,
          formattedPosition,
          state.team?.name ?? '',
        ];
      })
    );

    return states;
  }
}
