import {
  BaseCommand,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';

import {
  type ListProjectUpdatesQuery,
  type ProjectUpdateHealthType,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import {
  ValidationError as LibValidationError,
  NotFoundError,
} from '../../../lib/errors/index.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listProjectUpdates } from '../../../lib/operations/project-update/list-project-updates.js';
import {
  buildDateComparatorMap,
  formatDateErrorForFlag,
} from '../../utils/date-filters.js';
import { mapError } from '../../utils/errors/index.js';
import { normaliseMulti } from '../../utils/filters.js';
import { normalizeUpdateHealth } from '../../utils/normalize-update-health.js';
import { projectUpdateToTsv } from '../../utils/project-update.js';
import {
  resolveProjectId,
  resolveUserId,
} from '../../utils/resolvers/index.js';

type UpdateNode = ListProjectUpdatesQuery['projectUpdates']['nodes'][number];

export default class ProjectUpdateList extends BaseCommand<
  | Deps<LinearDeps<'GetProjects' | 'GetUsers' | 'ListProjectUpdates'>>
  | Result<UpdateNode[]>
> {
  static description = [
    'List project updates using structured filters (project, author, health, created-at).',
    '',
    'Output',
    '- TSV columns (in order): id, project, health, author, createdAt, url',
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
    '// Output: ProjectUpdate[]',
    '```',
  ].join('\n');

  static flags = {
    project: Flags.string({
      char: 'p',
      description: 'Filter by project name or ID',
    }),
    user: Flags.string({
      char: 'u',
      description: 'Filter by author (username/name, email, or UUID)',
    }),
    health: Flags.string({
      description:
        'Filter by update health (repeatable). Accepts onTrack|atRisk|offTrack and common aliases (on/off/risk).',
      multiple: true,
    }),
    created: Flags.string({
      description: [
        'Filter by created-at date using comparators (repeatable).',
        'Accepted operators: >, >=, <, <=, =, or none (equality).',
        'Accepted formats: YYYY-MM-DD or full ISO-8601 with Z/offset.',
        'Operators are literal (< and > strict; <= and >= inclusive).',
        'May be set multiple times to express ranges; equality must not be combined with other operators.',
        'Note: wrap values containing < or > in quotes.',
      ].join(' '),
      multiple: true,
    }),
    archived: Flags.boolean({
      description: 'Only archived updates',
      default: false,
      allowNo: true,
    }),
    sort: Flags.string({
      description: 'Sort by createdAt',
      default: 'createdAt',
    }),
    limit: Flags.integer({
      description: 'Maximum number of updates to return',
      default: 30,
      min: 1,
    }),
    first: Flags.integer({
      description: 'DEPRECATED: use --limit',
      hidden: true,
      min: 1,
    }),
    after: Flags.string({
      description: 'Pagination cursor for the first request',
    }),
  } as const;

  static examples = [
    '$ <%= config.bin %> <%= command.id %> --project "Website Refresh" --limit 20',
    '$ <%= config.bin %> <%= command.id %> --user riley --created ">=2025-10-01" --created "<2025-11-01" --json',
  ];

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<UpdateNode[]> {
    const { flags } = await this.parse(ProjectUpdateList);
    const { client, cache } = resolveDeps<
      Pick<Sdk, 'GetProjects' | 'GetUsers' | 'ListProjectUpdates'>
    >(deps, getLinearSdk);

    try {
      /* 1) Resolve IDs */
      const [projectId, userId] = await Promise.all([
        resolveProjectId(flags.project, { client, cache }),
        resolveUserId(flags.user, { client, cache }),
      ]);

      if (flags.project && !projectId) {
        throw new NotFoundError('project', flags.project);
      }

      /* 2) Sort handling (only createdAt supported; direction not supported) */
      let orderBy: 'createdAt' | undefined;
      if (flags.sort) {
        const [fieldRaw = '', dirRaw] = flags.sort.split(':');
        if (dirRaw !== undefined) {
          throw new LibValidationError(
            '--sort does not support direction (asc/desc). Use createdAt only.'
          );
        }
        if (fieldRaw !== 'createdAt') {
          throw new LibValidationError(
            'Invalid --sort field. Allowed: createdAt'
          );
        }
        orderBy = 'createdAt';
      }

      /* 3) createdAt comparator map */
      let createdAt:
        | {
            gt?: string | undefined;
            gte?: string | undefined;
            lt?: string | undefined;
            lte?: string | undefined;
            eq?: string | undefined;
          }
        | undefined;
      const createdRaw = flags.created;
      if (createdRaw !== undefined) {
        try {
          const createdVals = normaliseMulti(createdRaw);
          createdAt = buildDateComparatorMap(createdVals);
        } catch (err) {
          const msg = formatDateErrorForFlag(err, 'created');
          throw new LibValidationError(msg);
        }
      }

      /* 4) Health (repeatable) */
      const healthVals = normaliseMulti(flags.health);
      let health: ProjectUpdateHealthType[] | undefined;
      if (healthVals.length) {
        health = healthVals.map((h) => normalizeUpdateHealth(h));
      }

      /* 5) Execute */
      const updates = await listProjectUpdates(
        {
          projectId: projectId ?? undefined,
          userId: userId ?? undefined,
          health,
          createdAt,
          orderBy: orderBy ?? 'createdAt',
          first: flags.first ?? flags.limit,
          after: flags.after,
          archived: flags.archived,
        },
        { client, cache }
      );

      const header = ['id', 'project', 'health', 'author', 'createdAt', 'url'];
      const rows = updates.map((u) => projectUpdateToTsv(u));
      this.printRows(rows, { header });

      return updates;
    } catch (error: unknown) {
      const { message, exitCode } = mapError(error);
      throw Object.assign(new Error(message), { exitCode });
    }
  }
}
