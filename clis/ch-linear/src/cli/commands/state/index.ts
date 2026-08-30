import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * State topic entry‑point.
 *
 * Displays help for workflow‑state commands.
 */
export default class StateTopic extends BaseCommand {
  static description =
    'Inspect workflow states (statuses) available in the workspace';

  static examples = [
    '$ <%= config.bin %> state list',
    '$ <%= config.bin %> state list --json',
  ];

  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
