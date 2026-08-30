import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

export default class AgentSessionTopic extends BaseCommand {
  static description = 'Create and manage Linear agent sessions';

  static examples = [
    '<%= config.bin %> <%= command.id %> create --issue ENG-123',
    '<%= config.bin %> <%= command.id %> view <agentSessionId> --json',
  ];

  // Allow extraneous args so the bare topic command never errors
  static strict = false;
  static hidden = true;
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
