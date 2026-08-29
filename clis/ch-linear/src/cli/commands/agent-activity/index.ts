import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

export default class AgentActivityTopic extends BaseCommand {
  static description = 'Create and manage Linear agent activities';

  static examples = [
    '<%= config.bin %> <%= command.id %> create --session <agentSessionId> --type thought --body "Investigating"',
    '<%= config.bin %> <%= command.id %> list --session <agentSessionId> --json',
  ];

  static strict = false;
  static hidden = true;
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    const id = this.id;
    if (!id) {
      this.error('Unexpected missing command id.');
    }
    await new Help(this.config).showHelp([id]);
  }
}
