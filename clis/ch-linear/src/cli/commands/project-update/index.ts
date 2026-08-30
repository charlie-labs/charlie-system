import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

export default class ProjectUpdateTopic extends BaseCommand {
  static description = 'Create, view, edit, list, and archive project updates';

  static examples = [
    '$ <%= config.bin %> project-update list --project "Website Refresh"',
    '$ <%= config.bin %> project-update view 123e4567-e89b-12d3-a456-426614174000 --json',
  ];

  // Hidden so that oclif prints the children commands under the topic
  static hidden = true;
  static strict = false;
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id ?? 'project-update']);
  }
}
