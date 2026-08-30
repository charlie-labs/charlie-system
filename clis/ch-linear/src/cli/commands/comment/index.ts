import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Comment topic entry-point.
 *
 * Invoking `ch-linear comment` without a sub-command prints the list of
 * available comment commands (create, update, list, reaction add/remove, …).
 */
export default class CommentTopic extends BaseCommand {
  static description = 'Interact with Linear comments on issues';

  static examples = [
    '$ <%= config.bin %> comment list ENG-123',
    '$ <%= config.bin %> comment create --issue-id ENG-123 --body "Looks good" --json',
  ];

  static strict = false;
  static hidden = true;

  // Enable oclif built-in --json flag (no actual output here but keeps behaviour consistent)
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
