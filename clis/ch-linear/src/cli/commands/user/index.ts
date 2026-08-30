import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * User topic entry‑point.
 *
 * Exposes user‑related commands and their help.
 */
export default class UserTopic extends BaseCommand {
  static description =
    'Manage workspace users – list users with filtering options';

  static examples = [
    '$ <%= config.bin %> user list',
    '$ <%= config.bin %> user list --active --json',
  ];

  static strict = false;
  static hidden = true;

  // Do not expose --json on bare topic commands (no structured output)
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
