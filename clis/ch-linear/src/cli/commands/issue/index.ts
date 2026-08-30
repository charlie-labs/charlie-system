import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Help } from '@oclif/core';

/**
 * Issue topic entry‑point.
 *
 * Invoking `ch-linear issue` without a sub‑command prints the full list of
 * available issue commands (create, edit, search, view, …).
 */
export default class IssueTopic extends BaseCommand {
  static description =
    'Interact with Linear issues – create, edit, search, and view';

  static examples = [
    '$ <%= config.bin %> issue create --title "Fix crash on save" --team ENG',
    '$ <%= config.bin %> issue search "auth error" -T ENG --limit 20',
  ];

  // Allow extraneous args so the bare topic command never errors
  static strict = false;
  static hidden = true;

  static enableJsonFlag = false;

  protected async execute(): Promise<void> {
    await new Help(this.config).showHelp([this.id!]);
  }
}
