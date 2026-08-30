import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';

import {
  type ProjectUpdateCreateMutation,
  type ProjectUpdateCreateMutationVariables,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { NotFoundError, ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { createProjectUpdate as createOp } from '../../../lib/operations/project-update/create-project-update.js';
import { mapError } from '../../utils/errors/index.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { normalizeUpdateHealth } from '../../utils/normalize-update-health.js';
import { projectUpdateToTsv } from '../../utils/project-update.js';
import { resolveProjectId } from '../../utils/resolvers/index.js';
import { readAllStdin } from '../../utils/stdin.js';

export default class ProjectUpdateCreate extends BaseCommand<
  | Deps<LinearDeps<'ProjectUpdateCreate' | 'GetProjects'>>
  | Result<{
      update: NonNullable<
        ProjectUpdateCreateMutation['projectUpdateCreate']['projectUpdate']
      >;
    }>
> {
  static description = [
    'Create a new project update.',
    '',
    'Output',
    '- TSV columns (in order): id, project, health, author, createdAt, url',
    '- JSON shape:',
    '```ts',
    'type ProjectUpdate = { /* see `project-update list` */ };',
    '// Output: { update: ProjectUpdate }',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> --project "Website Refresh" --body "Shipping is on track" --health onTrack',
    '<%= config.bin %> <%= command.id %> --project "Website Refresh" --body - <<\'MD\'\nSprint 3 highlights…\nMD',
    '<%= config.bin %> <%= command.id %> --project "Website Refresh" --body "Shipping is on track" --health onTrack --json',
  ];

  static flags = {
    project: Flags.string({
      char: 'p',
      description: 'Project name or ID',
      required: true,
    }),
    body: Flags.string({
      char: 'b',
      description: 'Update body (markdown). Use "-" to read from stdin.',
      required: true,
    }),
    health: Flags.string({
      description:
        'Update health: onTrack | atRisk | offTrack (aliases supported)',
    }),
    'hide-diff': Flags.boolean({
      description: 'Hide the diff section for this update (isDiffHidden=true)',
      allowNo: true,
    }),
  } as const;

  protected override async execute({ deps }: ExecCtxOf<this>): Promise<{
    update: NonNullable<
      ProjectUpdateCreateMutation['projectUpdateCreate']['projectUpdate']
    >;
  }> {
    const { flags } = await this.parse(ProjectUpdateCreate);
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'ProjectUpdateCreate' | 'GetProjects'>
    >(deps, getLinearSdk);

    try {
      const projectId = await resolveProjectId(flags.project, {
        client,
        cache,
      });
      if (!projectId) {
        throw new NotFoundError('project', flags.project);
      }

      const input: ProjectUpdateCreateMutationVariables['input'] = {
        projectId,
        body: '', // fill below (stdin support)
      };

      let rawBody: string;

      // Support reading body from stdin when the sentinel '-' is used.
      if (flags.body === '-') {
        const stdinContent = await readAllStdin();
        if (stdinContent.length === 0) {
          throw new ValidationError(
            'Received --body - but no stdin was provided. Pipe or heredoc the body content, or pass an explicit string.'
          );
        }
        rawBody = stdinContent;
      } else {
        rawBody = flags.body;
      }

      input.body = await formatForLinearString(rawBody);

      if (flags.health) input.health = normalizeUpdateHealth(flags.health);
      if (flags['hide-diff'] !== undefined) {
        input.isDiffHidden = flags['hide-diff'];
      }

      const payload = await createOp({ input }, { client });
      // Operation guarantees success and presence of projectUpdate (or throws)
      const update = payload.projectUpdate;
      this.printRows([projectUpdateToTsv(update)]);
      return { update };
    } catch (error: unknown) {
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }
}
