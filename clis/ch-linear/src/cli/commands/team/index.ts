import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Team topic entry‑point.
 *
 * Provides access to team‑related sub‑commands.
 */
export default class TeamTopic extends BaseCommand {
  static description = 'Interact with Linear teams – list and inspect teams';

  static examples = [
    '$ <%= config.bin %> team list',
    '$ <%= config.bin %> team list --limit 10',
  ];

  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
