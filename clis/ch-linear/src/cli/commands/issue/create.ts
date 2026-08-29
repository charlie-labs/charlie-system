import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type CreateIssueMutation,
  type IssueCreateInput,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createIssue as createIssueOp } from '../../../lib/operations/issue/create-issue.js';
import { formatForLinear } from '../../utils/format-for-linear.js';
import {
  findFirstWorkflowStateId,
  resolveIssueId,
  resolveLabelIds,
  resolveProjectId,
  resolveStateId,
  resolveTeamId,
  resolveUserId,
} from '../../utils/resolvers/index.js';

/**
 * Create a new Linear issue.
 *
 *   $ <%= config.bin %> issue create --title "Bug: crash on save" --team ENG
 *
 *   # Output raw JSON response
 *   $ <%= config.bin %> issue create -t "Investigate memory leak" --json
 */
const manifest = defineFlags({
  title: {
    oclif: Flags.string({
      char: 't',
      description: 'Issue title',
      required: true,
    }),
    schema: z.string().min(1, 'title is required'),
  },
  description: {
    oclif: Flags.string({
      char: 'd',
      description: 'Issue description (markdown)',
    }),
    schema: z.string().optional(),
  },
  team: {
    oclif: Flags.string({
      char: 'm',
      description: 'Team key, name, or ID',
      required: true,
    }),
    schema: z.string().min(1, 'team is required'),
  },
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'Project name or ID (optional)',
    }),
    schema: z.string().optional(),
  },
  parent: {
    oclif: Flags.string({
      description: 'Parent issue identifier or UUID (optional)',
    }),
    schema: z.string().optional(),
  },
  draft: {
    oclif: Flags.boolean({
      description: 'Create issue as draft',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  estimate: {
    oclif: Flags.integer({
      description: 'Story‑point estimate (integer)',
    }),
    schema: z.number().int().optional(),
  },
  'target-date': {
    oclif: Flags.string({
      description: 'Target completion date (YYYY‑MM-DD or full ISO‑8601)',
    }),
    schema: z.string().optional(),
  },
  state: {
    oclif: Flags.string({
      description: 'Workflow state name or ID (optional)',
    }),
    schema: z.string().optional(),
  },
  open: {
    oclif: Flags.boolean({
      description: 'Mark issue as OPEN (moves to first "unstarted" state)',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  close: {
    oclif: Flags.boolean({
      description: 'Mark issue as CLOSED (moves to first "completed" state)',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  labels: {
    oclif: Flags.string({
      char: 'l',
      description: 'Comma‑separated list of label names or IDs (optional)',
    }),
    schema: z.string().optional(),
  },
  assignee: {
    oclif: Flags.string({
      char: 'a',
      description: 'Assignee user name, email, or ID (optional)',
    }),
    schema: z.string().optional(),
  },
  delegate: {
    oclif: Flags.string({
      description:
        'Delegated agent (app) user identifier (username/name, email, or UUID). Alias: --agent',
      aliases: ['agent'],
    }),
    schema: z.string().optional(),
  },
  priority: {
    oclif: Flags.integer({
      description: 'Priority 0‑4 (Linear priority scheme)',
      min: 0,
      max: 4,
    }),
    schema: z.number().int().min(0).max(4).optional(),
  },
} as const);

export default class IssueCreate extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<
      LinearDeps<
        | 'CreateIssue'
        | 'GetIssueByIdentifier'
        | 'ListIssues'
        | 'GetUsers'
        | 'GetProjects'
        | 'GetIssueLabels'
      >
    >
> {
  static override flags = super.registerManifest(manifest);
  static description = 'Create a new Linear issue';

  static examples = [
    '$ <%= config.bin %> issue create --team ENG --title "Bug: crash on save" --priority 2',
    '$ <%= config.bin %> issue create -m ENG -t "Investigate memory leak" -l bug,backend --json',
    // Delegate/agent on create
    '$ <%= config.bin %> issue create --team ENG -t "Automate triage" --delegate charlie',
  ];

  // flags are registered via manifest

  protected async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    issue: NonNullable<CreateIssueMutation['issueCreate']['issue']>;
  } | void> {
    const flags = parsed;
    const { client, cache } = resolveDeps<
      Pick<
        Sdk,
        | 'CreateIssue'
        | 'GetIssueByIdentifier'
        | 'ListIssues'
        | 'GetUsers'
        | 'GetProjects'
        | 'GetIssueLabels'
      >
    >(deps, getLinearSdk);

    if (flags.open && flags.close) {
      this.error('Cannot use --open and --close together.');
    }
    if ((flags.open || flags.close) && flags.state) {
      this.error('Cannot combine --state with --open/--close.');
    }
    if (flags.draft && (flags.open || flags.close)) {
      this.error('Cannot combine --draft with --open/--close.');
    }

    const title = flags.title.trim();
    if (!title) {
      this.error('Title cannot be empty.');
    }

    /* -- GATHER RESOLVER PROMISES ------------------------------------------- */

    // Pre‑parse any synchronous data required by the async resolvers
    const labelNames = flags.labels
      ? flags.labels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const parentRaw =
      flags.parent !== undefined ? flags.parent.trim() : undefined;

    // Prepare promises – any 'unused' resolver becomes an already-resolved promise
    const teamIdPromise = resolveTeamId(flags.team); // always required

    const labelIdsPromise: Promise<string[] | undefined> = labelNames
      ? resolveLabelIds(labelNames, {}, { client, cache })
      : Promise.resolve(undefined);

    // Resolve explicit state concurrently, scoped to the resolved team.
    // Normalise raw --state input to avoid whitespace mismatches.
    const desiredState =
      flags.state !== undefined ? flags.state.trim() : undefined;
    const stateIdPromise: Promise<string | undefined> = desiredState
      ? teamIdPromise.then((tId) =>
          resolveStateId(desiredState, {
            ...(tId ? { teamIds: [tId] } : {}),
          })
        )
      : Promise.resolve(undefined);

    const projectIdPromise: Promise<string | undefined> = flags.project
      ? resolveProjectId(flags.project, { client, cache })
      : Promise.resolve(undefined);

    const assigneeIdPromise: Promise<string | undefined> = flags.assignee
      ? resolveUserId(flags.assignee, { client, cache })
      : Promise.resolve(undefined);

    const delegateIdPromise: Promise<string | undefined> = flags.delegate
      ? resolveUserId(flags.delegate, { client, cache })
      : Promise.resolve(undefined);

    const parentIdPromise: Promise<string | null | undefined> =
      parentRaw === undefined
        ? Promise.resolve(undefined)
        : parentRaw.toLowerCase() === 'none'
          ? Promise.resolve(null)
          : resolveIssueId(parentRaw);

    // Execute all independent look‑ups concurrently
    const [
      teamId,
      labelIds,
      stateId,
      projectId,
      assigneeId,
      parentId,
      delegateId,
    ] = await Promise.all([
      teamIdPromise,
      labelIdsPromise,
      stateIdPromise,
      projectIdPromise,
      assigneeIdPromise,
      parentIdPromise,
      delegateIdPromise,
    ]);

    /* -- DERIVED / FOLLOW‑UP RESOLUTIONS ------------------------------------ */

    const description = await formatForLinear(flags.description);

    let chosenStateId = stateId;
    if (!chosenStateId && (flags.open || flags.close)) {
      const desired = flags.open ? 'unstarted' : 'completed';
      chosenStateId = await findFirstWorkflowStateId(desired, teamId);
      if (!chosenStateId) {
        this.error(
          `No workflow state of type "${desired}" found for --${
            flags.open ? 'open' : 'close'
          }.`
        );
      }
    }

    if (!chosenStateId && flags.draft) {
      chosenStateId = await findFirstWorkflowStateId('unstarted', teamId);
    }

    const inputData: IssueCreateInput & { draft?: boolean } = {
      teamId: teamId!, // resolved & guaranteed
      title,
    };
    if (description) inputData.description = description;
    if (projectId) inputData.projectId = projectId;
    if (chosenStateId) inputData.stateId = chosenStateId;
    if (labelIds) inputData.labelIds = labelIds;
    if (assigneeId) inputData.assigneeId = assigneeId;
    if (delegateId) inputData.delegateId = delegateId;
    if (typeof flags.priority === 'number') inputData.priority = flags.priority;

    if (flags.estimate !== undefined) {
      inputData.estimate = flags.estimate;
    }

    if (flags['target-date'] !== undefined) {
      const raw = flags['target-date'].trim();

      // Accept plain `YYYY-MM-DD` or any ISO‑8601 string.
      const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T00:00:00Z`)
        : new Date(raw);

      if (Number.isNaN(date.getTime())) {
        this.error(
          `Invalid date "${raw}" for --target-date. Provide YYYY-MM-DD or a valid ISO‑8601 string.`
        );
      }

      inputData.dueDate = date.toISOString();
    }

    if (flags.parent !== undefined) {
      // `parentId` may be: string | null
      inputData.parentId = parentId as string | null;
    }

    if (flags.draft) {
      inputData.draft = true;
    }

    /* ─── CREATE ISSUE ────────────────────────────────────────────────── */
    try {
      const resp = await createIssueOp({ input: inputData }, { client });
      const issue = resp.issue;
      if (!issue) {
        this.error('Issue creation failed – no issue returned.');
      }
      this.logInfo(`✓ Created ${issue!.identifier}: ${issue!.title}`);
      // JSON mode: return a single-key wrapper { issue }
      return { issue: issue! };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message);
    }
  }
}
