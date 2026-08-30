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
  type GetProjectsQuery,
  type Sdk,
} from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listProjects } from '../../../lib/operations/project/list-projects.js';
import {
  resolveInitiativeId,
  resolveTeamId,
} from '../../utils/resolvers/index.js';

/**
 * Convenience alias for the array of project nodes returned by the `GetProjects` GraphQL query.
 */

type ProjectNodes = GetProjectsQuery['projects']['nodes'];
/**
 * List projects in the workspace.
 *
 * Each project is printed on its own line in TSV with five columns:
 *
 *   <id>\t<name>\t<status>\t<teams>\t<initiatives>
 *
 * Multi-value columns (teams, initiatives) are comma+space separated.
 * When `--json` is supplied, TSV output is suppressed and the raw array
 * of project objects is returned to Oclif.
 */

const manifest = defineFlags({
  team: {
    oclif: Flags.string({
      char: 'T',
      description:
        'Filter by team key/name/ID – only projects belonging to this team are returned',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  'status-type': {
    oclif: Flags.string({
      char: 'S',
      description:
        'Filter by project status type (e.g. started, planned, completed). Case-insensitive.',
    }),
    schema: z.string().trim().min(1).optional(),
  },
  initiative: {
    oclif: Flags.string({
      char: 'I',
      description:
        'Filter by initiative name/ID – only projects linked to this initiative are returned',
    }),
    schema: z.string().trim().min(1).optional(),
  },
} as const);

export default class ProjectList extends BaseCommand<
  | CfgFlags<typeof manifest>
  | Deps<LinearDeps<'GetProjects'>>
  | Result<ProjectNodes>
> {
  static override flags = super.registerManifest(manifest);
  static description = [
    'List projects in the workspace.',
    '',
    'Output',
    '- TSV columns (in order): id, name, status, teams, initiatives',
    '- JSON shape:',
    '```ts',
    'type Project = {',
    '  id: uuid;',
    '  name: string;',
    '  description: string | null;',
    '  slugId: string | null;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '  status: { id: uuid; name: string; type: string } | null;',
    '  teams: { nodes: { id: uuid; name: string }[] } | null;',
    '  initiatives: { nodes: { id: uuid; name: string; slugId: string | null }[] } | null;',
    '};',
    '// Output: Project[]',
    '```',
  ].join('\n');

  static examples = [
    // Basic listing
    `<%= config.bin %> <%= command.id %>`,
    // Filter by team key
    `<%= config.bin %> <%= command.id %> --team CORE`,
    // Filter by status type
    `<%= config.bin %> <%= command.id %> --status-type active`,
    // Combine filters (AND semantics)
    `<%= config.bin %> <%= command.id %> --team CORE --initiative "Launch Platform"`,
    // JSON example
    `<%= config.bin %> <%= command.id %> --team CORE --json`,
  ];

  protected async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<ProjectNodes> {
    /*
     * ──────────────────────────────────────────────────────────────────────
     *  RESOLVE FLAG VALUES → IDs / VALIDATED STRINGS
     * ──────────────────────────────────────────────────────────────────── */

    /*
     * Normalise raw flag input – trim whitespace and convert to lower-case so
     * that subsequent resolution helpers and GraphQL filters operate on a
     * consistent, case-insensitive basis.
     */
    const teamFilter = parsed.team?.trim().toLowerCase();
    const initiativeFilter = parsed.initiative?.trim().toLowerCase();
    const statusTypeFilter = parsed['status-type']?.trim().toLowerCase();

    const [teamId, initiativeId] = await Promise.all([
      resolveTeamId(teamFilter),
      resolveInitiativeId(initiativeFilter),
    ]);

    // Status type does not have a dedicated ID resolver – we forward the
    // lower-cased string directly so the server performs the comparison using
    // `status.type { eq: $statusType }` in the GraphQL filter.
    const statusType = statusTypeFilter || undefined;

    /*
     * ──────────────────────────────────────────────────────────────────────
     *  FETCH PROJECTS VIA GRAPHQL (SERVER-SIDE FILTERING)
     * ──────────────────────────────────────────────────────────────────── */

    const { client, cache } = resolveDeps<Pick<Sdk, 'GetProjects'>>(
      deps,
      getLinearSdk
    );
    const projects = await listProjects(
      { teamId, statusType, initiativeId },
      { client, cache }
    );

    /*
     * ──────────────────────────────────────────────────────────────────────
     *  OUTPUT
     * ──────────────────────────────────────────────────────────────────── */

    this.printRows(
      projects.map((project) => {
        const teamNames = (project.teams?.nodes ?? [])
          .filter(Boolean)
          .map((t) => t?.name)
          .filter(Boolean)
          .join(', ');
        const initiativeTitles = (project.initiatives?.nodes ?? [])
          .filter(Boolean)
          .map(
            (i) =>
              (i as { name?: string; title?: string }).title ??
              (i as { name?: string }).name ??
              ''
          )
          .filter(Boolean)
          .join(', ');
        const statusName =
          (project as { status?: { name?: string } }).status?.name ?? '-';
        return [
          project.id,
          project.name,
          statusName,
          teamNames || '-',
          initiativeTitles || '-',
        ];
      })
    );
    return projects;
  }
}
