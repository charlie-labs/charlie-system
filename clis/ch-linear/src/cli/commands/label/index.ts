import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Label topic entry‑point.
 *
 * Provides easy access to help for label‑related commands.
 */
export default class LabelTopic extends BaseCommand {
  static description = 'Work with issue labels – list and inspect labels';

  static examples = [
    '$ <%= config.bin %> label list',
    '$ <%= config.bin %> label list --limit 10 --json',
  ];

  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
