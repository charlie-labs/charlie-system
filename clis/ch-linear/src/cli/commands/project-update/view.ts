import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import {
  type GetProjectUpdateQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { getProjectUpdate } from '../../../lib/operations/project-update/get-project-update.js';
import { mapError } from '../../utils/errors/index.js';
import { userDisplayName } from '../../utils/format.js';

export default class ProjectUpdateView extends BaseCommand<
  | Deps<LinearDeps<'GetProjectUpdate'>>
  | Result<GetProjectUpdateQuery['projectUpdate']>
> {
  static description = [
    'Show full details of a project update.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type ProjectUpdate = {',
    '  id: uuid;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '  body: string;',
    '  url: string;',
    '  health: "onTrack" | "atRisk" | "offTrack";',
    '  user: { id: uuid; name: string | null; displayName: string | null } | null;',
    '  project: { id: uuid; name: string; slugId: string | null } | null;',
    '  diffMarkdown?: string | null;',
    '};',
    '// Output: ProjectUpdate',
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
  }: ExecCtxOf<this>): Promise<GetProjectUpdateQuery['projectUpdate']> {
    const { args } = await this.parse(ProjectUpdateView);
    const { client, cache } = resolveDeps<Pick<Sdk, 'GetProjectUpdate'>>(
      deps,
      getLinearSdk
    );

    try {
      const update = await getProjectUpdate({ id: args.id }, { client, cache });
      if (this.jsonEnabled()) return update;

      const { id, project, user, health, createdAt, updatedAt, url, body } =
        update;

      this.logInfo(`${id}`);
      this.logInfo(`Project   : ${project?.name ?? '—'}`);
      this.logInfo(`Author    : ${userDisplayName(user) || '—'}`);
      this.logInfo(`Health    : ${health}`);
      this.logInfo(`Created   : ${new Date(createdAt).toLocaleString()}`);
      this.logInfo(`Updated   : ${new Date(updatedAt).toLocaleString()}`);
      this.logInfo(`URL       : ${url}`);

      if (typeof body === 'string' && body.trim()) {
        this.logInfo('\nBody (markdown):\n');
        this.logInfo(body.trim());
      }

      return update;
    } catch (error: unknown) {
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }
}
