import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';

import { type GetInitiativesQuery } from '../../../generated/linear-sdk.js';
import { getInitiatives } from '../../../lib/linear/cache-loaders.js';

/**
 * Convenience type alias for initiative node array.
 */
type InitiativeNodes = GetInitiativesQuery['initiatives']['nodes'];

/**
 * List initiatives in the workspace.
 *
 * Prints each initiative on its own line in TSV with three columns:
 *
 *   <id>\t<name>\t<projects>
 *
 * The `projects` column shows a comma+space joined list of up to 20 project
 * names linked to the initiative ("-" when none).
 *
 * If `--json` is supplied, TSV is suppressed and the JSON array of
 * initiative objects is returned directly to Oclif.
 */
export default class InitiativeList extends BaseCommand {
  static description = [
    'List initiatives.',
    '',
    'Output',
    '- TSV columns (in order): id, name, projects',
    '- JSON shape:',
    '```ts',
    'type Initiative = {',
    '  id: uuid;',
    '  name: string;',
    '  description: string | null;',
    '  targetDate: ISODate | null;',
    '  startedAt: ISODate | null;',
    '  completedAt: ISODate | null;',
    '  color: string | null;',
    '  createdAt: ISODate;',
    '  updatedAt: ISODate;',
    '  projects: {',
    '    nodes: {',
    '      id: uuid;',
    '      name: string;',
    '      description: string | null;',
    '      status: { id: uuid; name: string; type: string; position: number } | null;',
    '    }[];',
    '  } | null;',
    '};',
    '// Output: Initiative[]',
    '```',
  ].join('\n');

  static examples = [
    '$ <%= config.bin %> initiative list',
    '$ <%= config.bin %> initiative list --json',
  ];

  protected async execute(): Promise<InitiativeNodes> {
    const initiatives = await getInitiatives();
    this.printRows(
      initiatives.map((initiative) => {
        const projectNames = (initiative.projects?.nodes ?? [])
          .filter(Boolean)
          .map((p) => p?.name)
          .filter(Boolean)
          .join(', ');
        return [initiative.id, initiative.name, projectNames || '-'];
      })
    );
    return initiatives;
  }
}
