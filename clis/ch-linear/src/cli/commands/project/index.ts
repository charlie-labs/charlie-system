import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Project topic entry‑point.
 *
 * Shows help for all project‑related sub‑commands.
 */
export default class ProjectTopic extends BaseCommand {
  static description =
    'Manage Linear projects – list projects or inspect individual projects';

  static examples = [
    '$ <%= config.bin %> project list',
    '$ <%= config.bin %> project list --json',
  ];

  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
