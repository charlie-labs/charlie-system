import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type Deps,
  type ExecCtxOf,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';
import { z } from 'zod3';

import {
  type IssueUpdateInput,
  type Sdk,
  type UpdateIssueMutation,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { updateIssue as updateIssueOp } from '../../../lib/operations/issue/update-issue.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import {
  findFirstWorkflowStateId,
  getTeamIdForStateId,
  resolveIssueId,
  resolveLabelIds,
  resolveProjectId,
  resolveStateId,
  resolveTeamId,
  resolveUserId,
} from '../../utils/resolvers/index.js';

// Removed unused type aliases: WorkflowStateTypeLiteral, WorkflowStateNodes, IssueLabelNodes

/**
 * Edit / update an existing Linear issue.
 *
 * Examples
 *   # Change title & priority
 *   $ <%= config.bin %> issue edit ENG-42 -t "New title" --priority 1
 *
 *   # Move to a different workflow state
 *   $ <%= config.bin %> issue edit 123e4567-e89b-12d3-a456-426614174000 --state "In Progress"
 *
 *   # Replace labels and output raw JSON response
 *   $ <%= config.bin %> issue edit ENG-99 -l bug,frontend --json
 */
const manifest = defineFlags({
  title: {
    oclif: Flags.string({
      char: 't',
      description: 'New issue title',
    }),
    schema: z.string().optional(),
  },
  description: {
    oclif: Flags.string({
      char: 'd',
      description: 'New issue description (markdown)',
    }),
    schema: z.string().optional(),
  },
  team: {
    oclif: Flags.string({
      char: 'm',
      description: 'New team key, name, or ID',
    }),
    schema: z.string().optional(),
  },
  project: {
    oclif: Flags.string({
      char: 'p',
      description: 'New project name or ID',
    }),
    schema: z.string().optional(),
  },
  state: {
    oclif: Flags.string({
      description: 'New workflow state name or ID',
    }),
    schema: z.string().optional(),
  },
  labels: {
    oclif: Flags.string({
      char: 'l',
      description:
        'Comma‑separated list of label names or IDs to REPLACE existing labels',
    }),
    schema: z.string().optional(),
  },
  'add-label': {
    oclif: Flags.string({
      description:
        'Comma‑separated list of label names or IDs to ADD to existing labels',
    }),
    schema: z.string().optional(),
  },
  'remove-label': {
    oclif: Flags.string({
      description:
        'Comma‑separated list of label names or IDs to REMOVE from existing labels',
    }),
    schema: z.string().optional(),
  },
  assignee: {
    oclif: Flags.string({
      char: 'a',
      description: 'Assignee user name, email, or ID',
    }),
    schema: z.string().optional(),
  },
  delegate: {
    oclif: Flags.string({
      description:
        'Delegated agent (app) user identifier (username/name, email, or UUID). Alias: --agent. Use "clear" or "none" to remove.',
      aliases: ['agent'],
    }),
    schema: z.string().optional(),
  },
  priority: {
    oclif: Flags.integer({
      description: 'Priority 0‑4',
      min: 0,
      max: 4,
    }),
    schema: z.number().int().min(0).max(4).optional(),
  },
  estimate: {
    oclif: Flags.string({
      description: 'Story‑point estimate (integer) or "clear"',
    }),
    // Accept numeric-as-string (non-negative integer) or the sentinel "clear"
    schema: z
      .union([
        z.literal('clear'),
        z
          .string()
          .regex(
            /^(?:0|[1-9]\d*)$/,
            'must be a non‑negative integer or "clear"'
          ),
      ])
      .optional(),
  },
  'target-date': {
    oclif: Flags.string({
      description: 'Target completion date (YYYY‑MM‑DD or full ISO‑8601)',
    }),
    schema: z.string().optional(),
  },
  parent: {
    oclif: Flags.string({
      description: 'Parent issue identifier or UUID',
    }),
    schema: z.string().optional(),
  },
  open: {
    oclif: Flags.boolean({
      description:
        'Mark issue as OPEN (moves to the first "unstarted" workflow state)',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  close: {
    oclif: Flags.boolean({
      description:
        'Mark issue as CLOSED (moves to the first "completed" workflow state)',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  yes: {
    oclif: Flags.boolean({
      char: 'y',
      description: 'No‑op flag kept for backwards compatibility',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
} as const);

export default class IssueEdit extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<
      LinearDeps<
        | 'GetIssue'
        | 'UpdateIssue'
        | 'GetUsers'
        | 'GetProjects'
        | 'GetIssueLabels'
      >
    >
> {
  static override flags = super.registerManifest(manifest);
  static description = 'Update fields on an existing Linear issue';

  static examples = [
    '$ <%= config.bin %> issue edit ENG-42 -t "New title"',
    '$ <%= config.bin %> issue edit ENG-99 --state "In Progress" --priority 2',
    '$ <%= config.bin %> issue edit ENG-21 --add-label backend --remove-label bug',
    '$ <%= config.bin %> issue edit ENG-55 --close --yes',
    // Delegate/agent set and clear
    '$ <%= config.bin %> issue edit ENG-77 --delegate charlie',
    '$ <%= config.bin %> issue edit ENG-77 --delegate clear',
    '$ <%= config.bin %> issue edit ENG-77 --delegate charlie --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Linear issue UUID or identifier (e.g., ENG-123)',
    }),
  };
  // flags are registered via manifest

  /* ──────────────────────────────────────────────────────────────────────
   *  MAIN RUN
   * ─────────────────────────────────────────────────────────────────── */

  protected async execute({ parsed, deps }: ExecCtxOf<this>): Promise<{
    issue: NonNullable<UpdateIssueMutation['issueUpdate']['issue']>;
  } | void> {
    const { args } = await this.parse(IssueEdit);
    const flags = parsed;

    /* ─── VALIDATION ────────────────────────────────────────────────── */

    if (flags.open && flags.close) {
      this.error('Cannot use --open and --close together.');
    }

    if (
      flags.labels !== undefined &&
      (flags['add-label'] !== undefined || flags['remove-label'] !== undefined)
    ) {
      this.error(
        'Use either --labels (replace) OR --add-label/--remove-label (modify) – not both.'
      );
    }

    if ((flags.open || flags.close) && flags.state) {
      this.error('Cannot combine --state with --open/--close.');
    }

    // Ensure at least one mutating flag is supplied
    const mutatingProvided = [
      flags.title,
      flags.description,
      flags.team,
      flags.project,
      flags.state,
      flags.labels,
      flags['add-label'],
      flags['remove-label'],
      flags.assignee,
      typeof flags.priority === 'number' ? flags.priority : undefined,
      flags.open ? true : undefined,
      flags.close ? true : undefined,
      flags.estimate,
      flags['target-date'],
      flags.parent,
    ].some((v) => v !== undefined);

    if (!mutatingProvided) {
      this.error(
        'No changes specified. Provide at least one mutating flag to update the issue.'
      );
    }

    const { client, cache } = resolveDeps<
      Pick<
        Sdk,
        | 'GetIssue'
        | 'UpdateIssue'
        | 'GetUsers'
        | 'GetProjects'
        | 'GetIssueLabels'
      >
    >(deps, getLinearSdk);

    /* ─── RESOLVE ISSUE UUID ─────────────────────────────────────────── */

    const issueId = await resolveIssueId(args.id);

    /* ─── FETCH CURRENT ISSUE DATA (needed for labels, states, etc.) ── */

    const { issue: currentIssue } = await client.GetIssue({
      id: issueId!,
    });

    // The --yes flag is retained for backwards compatibility but has no effect.

    /* ─── PARSE & PARALLELISE RESOLVER CALLS ───────────────────────────── */

    /* 1.  Synchronously pre‑parse any flag strings that need trimming /
     *     splitting so we don’t repeat that work in multiple places.
     * ------------------------------------------------------------------ */
    const labelNames =
      flags.labels !== undefined
        ? flags.labels
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const parentRaw =
      flags.parent !== undefined ? flags.parent.trim() : undefined;

    /* 2.  Kick off all resolver look‑ups **without** awaiting so they can
     *     run concurrently. Each branch falls back to a resolved promise
     *     when the related flag wasn’t provided so that `Promise.all`
     *     always has the same number/order of entries.
     * ------------------------------------------------------------------ */
    const teamIdPromise: Promise<string | undefined> = flags.team
      ? resolveTeamId(flags.team)
      : Promise.resolve(undefined);

    const labelIdsPromise: Promise<string[] | undefined> = labelNames
      ? resolveLabelIds(labelNames, {}, { client, cache })
      : Promise.resolve(undefined);

    // Normalise raw --state input to avoid whitespace mismatches.
    const desiredState =
      flags.state !== undefined ? flags.state.trim() : undefined;
    const stateIdPromise: Promise<string | undefined> = desiredState
      ? (async () => {
          const maybeNewTeamId = await teamIdPromise;
          const fallbackTeamId =
            maybeNewTeamId ??
            (await getTeamIdForStateId(currentIssue.state.id));
          return resolveStateId(desiredState, {
            ...(fallbackTeamId ? { teamIds: [fallbackTeamId] } : {}),
          });
        })()
      : Promise.resolve(undefined);

    const projectIdPromise: Promise<string | undefined> = flags.project
      ? resolveProjectId(flags.project, { client, cache })
      : Promise.resolve(undefined);

    const assigneeIdPromise: Promise<string | undefined> = flags.assignee
      ? resolveUserId(flags.assignee, { client, cache })
      : Promise.resolve(undefined);

    const delegateIdPromise: Promise<string | null | undefined> =
      flags.delegate === undefined
        ? Promise.resolve(undefined)
        : ['clear', 'none'].includes(flags.delegate.trim().toLowerCase())
          ? Promise.resolve(null)
          : resolveUserId(flags.delegate, { client, cache });

    const parentIdPromise: Promise<string | null | undefined> =
      parentRaw === undefined
        ? Promise.resolve(undefined)
        : parentRaw.toLowerCase() === 'none'
          ? Promise.resolve(null)
          : resolveIssueId(parentRaw);

    /* 3.  Await all of the above together. The variable names match the
     *     promises’ intent for clarity.
     * ------------------------------------------------------------------ */
    const [
      teamId,
      labelIds,
      explicitStateId,
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

    /* ─── BUILD UPDATE INPUT ─────────────────────────────────────────── */

    const inputData: IssueUpdateInput = {};

    if (flags.title) inputData.title = flags.title.trim();

    // Support reading description from stdin when the sentinel '-' is used.
    // This enables heredoc/piped content: `--description - <<'MD' ... MD` or
    // `printf "text" | ch-linear issue edit ... --description -`.
    if (flags.description !== undefined) {
      if (flags.description === '-') {
        const stdinContent = await readAllStdin();
        if (stdinContent.length === 0) {
          this.error(
            'Received --description - but no stdin was provided. Pipe or heredoc the description content, or pass an explicit string.'
          );
        }
        inputData.description = await formatForLinearString(stdinContent);
      } else {
        inputData.description = await formatForLinearString(flags.description);
      }
    }

    if (flags.priority !== undefined) {
      inputData.priority = flags.priority;
    }

    /* TEAM ---------------------------------------------------------------- */

    if (flags.team && teamId) {
      inputData.teamId = teamId;
    }

    /* PROJECT ------------------------------------------------------------- */

    if (flags.project && projectId) {
      inputData.projectId = projectId;
    }

    /* --------------------------------------------------------------------
     * Determine the team to use when resolving implicit “open/close” states.
     *  • If the user is moving the issue to a new team (`--team`), prefer it.
     *  • Otherwise, fall back to the team that owns the current state.
     * ------------------------------------------------------------------ */
    const targetTeamId =
      inputData.teamId ?? (await getTeamIdForStateId(currentIssue.state.id));

    /* STATE – explicit flag, open, close ---------------------------------- */

    if (flags.state) {
      if (explicitStateId) inputData.stateId = explicitStateId;
    } else if (flags.open) {
      const openStateId = await findFirstWorkflowStateId(
        'unstarted',
        targetTeamId
      );
      if (!openStateId) {
        this.error('No workflow state of type "unstarted" found for --open.');
      }
      inputData.stateId = openStateId;
    } else if (flags.close) {
      const closeStateId = await findFirstWorkflowStateId(
        'completed',
        targetTeamId
      );
      if (!closeStateId) {
        this.error('No workflow state of type "completed" found for --close.');
      }
      inputData.stateId = closeStateId;
    }

    /* LABELS -------------------------------------------------------------- */

    if (flags.labels !== undefined) {
      if (labelIds) inputData.labelIds = labelIds;
    } else if (
      flags['add-label'] !== undefined ||
      flags['remove-label'] !== undefined
    ) {
      // Start with current label IDs
      const currentLabelIds = currentIssue.labels?.nodes.map((l) => l.id) ?? [];
      const workSet = new Set<string>(currentLabelIds);

      /* ADD -------------------------------------------------------------- */
      if (flags['add-label']) {
        const addList = flags['add-label']
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const addIds = await resolveLabelIds(addList, {}, { client, cache });
        addIds?.forEach((id) => workSet.add(id));
      }

      /* REMOVE ----------------------------------------------------------- */
      if (flags['remove-label']) {
        const removeList = flags['remove-label']
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const removeIds = await resolveLabelIds(
          removeList,
          {},
          { client, cache }
        );
        removeIds?.forEach((id) => workSet.delete(id));
      }

      inputData.labelIds = Array.from(workSet);
    }

    /* ASSIGNEE ------------------------------------------------------------ */

    if (flags.assignee !== undefined && assigneeId) {
      inputData.assigneeId = assigneeId;
    }

    /* DELEGATE ------------------------------------------------------------ */

    if (flags.delegate !== undefined) {
      // May be string id, null (clear), or undefined (shouldn't happen here)
      if (delegateId === null) {
        inputData.delegateId = null;
      } else if (delegateId) {
        inputData.delegateId = delegateId;
      }
    }

    /* ESTIMATE ----------------------------------------------------------- */

    if (flags.estimate !== undefined) {
      const estRaw = flags.estimate.trim();
      if (estRaw.toLowerCase() === 'clear') {
        inputData.estimate = null;
      } else {
        const estimateVal = Number(estRaw);
        if (Number.isNaN(estimateVal)) {
          this.error('--estimate must be a number or "clear".');
        }
        inputData.estimate = estimateVal;
      }
    }

    /* TARGET DATE --------------------------------------------------------- */

    if (flags['target-date'] !== undefined) {
      const targetRaw = flags['target-date'].trim();
      if (targetRaw.toLowerCase() === 'clear') {
        inputData.dueDate = null;
      } else {
        const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
        if (dateOnlyPattern.test(targetRaw)) {
          const isoMidnight = `${targetRaw}T00:00:00Z`;
          const dateObj = new Date(isoMidnight);
          if (Number.isNaN(dateObj.getTime())) {
            this.error('--target-date must be a valid YYYY-MM-DD date.');
          }
          inputData.dueDate = isoMidnight;
        } else {
          const dateObj = new Date(targetRaw);
          if (Number.isNaN(dateObj.getTime())) {
            this.error('--target-date must be a valid date string.');
          }
          inputData.dueDate = dateObj.toISOString();
        }
      }
    }

    /* PARENT -------------------------------------------------------------- */

    if (flags.parent !== undefined) {
      // `parentId` is either string | null | undefined based on the earlier
      // resolution logic.
      if (parentId !== undefined) inputData.parentId = parentId;
    }

    /* ─── UPDATE ISSUE ──────────────────────────────────────────────── */
    try {
      const resp = await updateIssueOp(
        { id: issueId!, input: inputData },
        { client }
      );

      const issue = resp.issue;
      if (!issue) {
        this.error('Issue update failed.');
      }
      this.logInfo(`✓ Updated ${issue!.identifier}: ${issue!.title}`);
      // JSON mode: return a single-key wrapper { issue }
      return { issue: issue! };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message);
    }
  }
}

/**
 * Read entire stdin as a UTF‑8 string. Returns an empty string immediately
 * when stdin is a TTY (no pipe/heredoc), avoiding interactive blocking.
 */
async function readAllStdin(): Promise<string> {
  const { stdin } = process;
  if (stdin.isTTY) return '';
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    stdin.once('error', (err) => reject(err));
    stdin.once('end', () => resolve(data));
    // Ensure the stream is flowing
    try {
      stdin.resume();
    } catch {
      // ignore
    }
  });
}
