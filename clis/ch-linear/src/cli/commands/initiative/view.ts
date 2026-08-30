import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Args } from '@oclif/core';

import { type GetInitiativeQuery } from '../../../generated/linear-sdk.js';
import { getLinearSdk } from '../../../lib/linear/linear-sdk.js';
import { resolveInitiativeId } from '../../utils/resolvers/index.js';

// ---------------------------------------------------------------------------
//  Derived types
// ---------------------------------------------------------------------------

type InitiativeDetails = NonNullable<GetInitiativeQuery['initiative']>;

export default class InitiativeView extends BaseCommand {
  static description = 'Show full details of a Linear initiative';

  static examples = [
    '$ <%= config.bin %> initiative view 3e4c0b5b-8c49-4b3c-b8f1-0d9a99f4d123',
    '$ <%= config.bin %> initiative view "Roadmap Overhaul"',
  ];

  static args = {
    id: Args.string({
      required: true,
      description: 'Initiative UUID or name',
    }),
  } as const;

  protected async execute(): Promise<InitiativeDetails | void> {
    const { args } = await this.parse(InitiativeView);
    const linear = getLinearSdk();

    try {
      const initiativeId = await resolveInitiativeId(args.id);
      if (!initiativeId) {
        this.error('Initiative not found.');
      }

      const { initiative } = await linear.GetInitiative({ id: initiativeId! });
      if (!initiative) {
        this.error('Initiative not found.');
        return;
      }

      if (this.jsonEnabled()) return initiative;

      this.printInitiativeHeader(initiative);
      this.printProjects(initiative.projects?.nodes ?? []);

      return initiative;
    } catch (error: unknown) {
      this.error(`Failed to fetch initiative: ${(error as Error).message}`);
    }
  }

  // -----------------------------------------------------------------------
  //  Helper functions
  // -----------------------------------------------------------------------

  private printInitiativeHeader(initiative: InitiativeDetails): void {
    this.logInfo(`${initiative.name}`);
    this.logInfo('-'.repeat(initiative.name.length));
    this.logInfo(`ID        : ${initiative.id}`);
    if (initiative.targetDate) {
      this.logInfo(
        `Target    : ${new Date(initiative.targetDate).toLocaleDateString()}`
      );
    }

    if (initiative.description?.trim()) {
      this.logInfo('\nDescription:\n');
      this.logInfo(initiative.description.trim());
    }
  }

  private printProjects(
    projects: InitiativeDetails['projects']['nodes']
  ): void {
    this.logInfo('\nProjects:\n');
    if (!projects || projects.length === 0) {
      this.logInfo('- No projects linked -');
      return;
    }
    for (const p of projects) {
      if (!p) continue;
      this.logInfo(`${p.id}\t${p.name}`);
    }
  }
}
