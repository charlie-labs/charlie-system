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

import { type GetTeamsQuery, type Sdk } from '../../../generated/linear-sdk.js';
import { type LinearDeps, resolveDeps } from '../../../lib/deps.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { listTeams } from '../../../lib/operations/team/list-teams.js';

type TeamNodes = GetTeamsQuery['teams']['nodes'];
const DEFAULT_LIMIT = 50;

/**
 * List teams in the Linear workspace.
 *
 * Teams are fetched in pages of 50 (the GraphQL default) until either the
 * requested limit has been printed or no more teams are available. Each team
 * is printed on its own line in the format:
 *
 *   <id>\t<key>\t<name>
 */
const manifest = defineFlags({
  limit: {
    oclif: Flags.integer({
      char: 'l',
      description: 'Maximum number of teams to list (default 50, max 10,000)',
      default: DEFAULT_LIMIT,
      min: 1,
      max: 10_000,
    }),
    schema: zPositiveInt({ default: DEFAULT_LIMIT, max: 10_000 }),
  },
} as const);

export default class TeamList extends BaseCommand<
  CfgFlags<typeof manifest> | Deps<LinearDeps<'GetTeams'>> | Result<TeamNodes>
> {
  static override get manifest() {
    return manifest;
  }
  static description = [
    'List all teams in the workspace.',
    '',
    'Output',
    '- TSV columns (in order): id, key, name',
    '- JSON shape:',
    '```ts',
    'type Team = {',
    '  id: uuid;',
    '  key: string;',
    '  name: string;',
    '};',
    '// Output: Team[]',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --limit 10',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  protected async execute(ctx: ExecCtxOf<this>): Promise<TeamNodes> {
    const parsedLimit = ctx.parsed.limit;
    const { client, cache } = resolveDeps<Pick<Sdk, 'GetTeams'>>(
      ctx.deps,
      getLinearSdk
    );
    const teams = await listTeams({ limit: parsedLimit }, { client, cache });
    this.printRows(teams.map((team) => [team.id, team.key, team.name]));
    return teams;
  }
}
