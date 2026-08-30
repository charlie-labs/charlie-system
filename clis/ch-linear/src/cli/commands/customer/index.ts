import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Customer topic entry-point.
 *
 * Provides help for customer-related sub-commands (list, create).
 */
export default class CustomerTopic extends BaseCommand {
  static description = 'Work with customers – list and create';

  static examples = [
    '$ <%= config.bin %> customer list',
    '$ <%= config.bin %> customer list --name Acme --json',
    '$ <%= config.bin %> customer create --name "Acme Co"',
  ];

  static strict = false; // delegates handling to sub-commands
  static hidden = true; // hide bare topic from command listings

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
