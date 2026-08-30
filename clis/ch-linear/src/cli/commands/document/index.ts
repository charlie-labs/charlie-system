import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

export default class DocumentTopic extends BaseCommand {
  static description = 'Interact with Linear documents';

  static examples = [
    '$ <%= config.bin %> document create --title "Design Doc" --content "# Draft"',
    '$ <%= config.bin %> document search onboarding --json',
  ];

  // Hidden so that oclif prints the children commands under the topic
  static hidden = true;
  static strict = false;
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id ?? 'document']);
  }
}
