import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * API topic entry-point.
 *
 * Provides help for low-level API access helpers.
 */
export default class ApiTopic extends BaseCommand {
  static description = 'Low-level API access helpers';

  static examples = [
    '$ <%= config.bin %> api',
    '$ <%= config.bin %> api --help',
  ];

  static strict = false; // delegates handling to sub-commands
  static hidden = true; // hide bare topic from command listings

  static override enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
