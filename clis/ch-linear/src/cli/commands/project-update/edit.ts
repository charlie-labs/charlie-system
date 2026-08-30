import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args, Flags } from '@oclif/core';

import {
  type ProjectUpdateUpdateMutation,
  type ProjectUpdateUpdateMutationVariables,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { ValidationError } from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { updateProjectUpdate as updateOp } from '../../../lib/operations/project-update/update-project-update.js';
import { mapError } from '../../utils/errors/index.js';
import { formatForLinearString } from '../../utils/format-for-linear.js';
import { normalizeUpdateHealth } from '../../utils/normalize-update-health.js';
import { projectUpdateToTsv } from '../../utils/project-update.js';
import { readAllStdin } from '../../utils/stdin.js';

export default class ProjectUpdateEdit extends BaseCommand<
  | Deps<LinearDeps<'ProjectUpdateUpdate'>>
  | Result<{
      update: NonNullable<
        ProjectUpdateUpdateMutation['projectUpdateUpdate']['projectUpdate']
      >;
    }>
> {
  static description = [
    'Update an existing project update.',
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
    '<%= config.bin %> <%= command.id %> 123e… --health atRisk --body -',
    '<%= config.bin %> <%= command.id %> 123e… --health offTrack --hide-diff --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Project update ID (UUID)',
    }),
  } as const;

  static flags = {
    body: Flags.string({
      char: 'b',
      description: 'New update body (markdown). Use "-" to read from stdin.',
    }),
    health: Flags.string({
      description:
        'New health: onTrack | atRisk | offTrack (aliases supported)',
    }),
    'hide-diff': Flags.boolean({
      description: 'Hide the diff section for this update (isDiffHidden=true)',
      allowNo: true,
    }),
  } as const;

  protected override async execute({ deps }: ExecCtxOf<this>): Promise<{
    update: NonNullable<
      ProjectUpdateUpdateMutation['projectUpdateUpdate']['projectUpdate']
    >;
  }> {
    const { args, flags } = await this.parse(ProjectUpdateEdit);
    const { client } = resolveDeps<Pick<Sdk, 'ProjectUpdateUpdate'>>(
      deps,
      getLinearSdk
    );

    try {
      const input: ProjectUpdateUpdateMutationVariables['input'] = {};

      if (flags.body !== undefined) {
        let rawBody: string;
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
      }

      if (flags.health !== undefined) {
        input.health = normalizeUpdateHealth(flags.health);
      }

      if (flags['hide-diff'] !== undefined) {
        input.isDiffHidden = flags['hide-diff'];
      }

      if (Object.keys(input).length === 0) {
        throw new ValidationError('No update flags provided. Nothing to do.');
      }

      const payload = await updateOp({ id: args.id, input }, { client });
      const update = payload.projectUpdate; // guaranteed by operation or it throws
      this.printRows([projectUpdateToTsv(update)]);
      return { update };
    } catch (error: unknown) {
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }
}
