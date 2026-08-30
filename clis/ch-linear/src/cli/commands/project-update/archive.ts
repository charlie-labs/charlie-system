import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import {
  type ProjectUpdateArchiveMutation,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { archiveProjectUpdate as archiveOp } from '../../../lib/operations/project-update/archive-project-update.js';
import { mapError } from '../../utils/errors/index.js';

export default class ProjectUpdateArchive extends BaseCommand<
  | Deps<LinearDeps<'ProjectUpdateArchive'>>
  | Result<ProjectUpdateArchiveMutation['projectUpdateArchive']>
> {
  static description = [
    'Archive a project update by ID.',
    '',
    'Output',
    '- TSV columns (in order): id, archived',
    '- JSON shape:',
    '```ts',
    '{ success: boolean; lastSyncId?: number }',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> 123e4567-e89b-12d3-a456-426614174000',
    '<%= config.bin %> <%= command.id %> 123e4567-e89b-12d3-a456-426614174000 --json',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Project update ID (UUID)',
    }),
  } as const;

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<
    ProjectUpdateArchiveMutation['projectUpdateArchive']
  > {
    const { args } = await this.parse(ProjectUpdateArchive);
    const { client } = resolveDeps<Pick<Sdk, 'ProjectUpdateArchive'>>(
      deps,
      getLinearSdk
    );

    try {
      const payload = await archiveOp({ id: args.id }, { client });

      // TSV
      this.printRows([[args.id, String(payload.success)]], {
        header: ['id', 'archived'],
      });

      // JSON wrapper: return the raw payload
      return payload;
    } catch (error: unknown) {
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }
}
