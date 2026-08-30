import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Workspace topic entry point.
 */
export default class WorkspaceTopic extends BaseCommand {
  static description = 'Workspace-level views and reports';
  static examples = [
    '$ <%= config.bin %> workspace overview',
    '$ <%= config.bin %> workspace overview --json',
  ];
  static strict = false;
  static hidden = false;
  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    // oclif guarantees an id at runtime, but avoid a non-null assertion per TS guidelines.
    await new Help(this.config).showHelp([this.id ?? 'workspace']);
  }
}
