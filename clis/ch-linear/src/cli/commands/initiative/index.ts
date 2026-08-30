import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Initiative topic entry-point – mirrors existing pattern used by `project`.
 *
 * Hidden command that simply prints the help for sub-commands.
 */
export default class InitiativeTopic extends BaseCommand {
  static description =
    'Manage Linear initiatives – list, view, create, and update initiatives';

  static examples = [
    '$ <%= config.bin %> initiative list',
    '$ <%= config.bin %> initiative view "Cloud Migration"',
  ];

  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
