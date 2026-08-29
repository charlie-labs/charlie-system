import { type ExecCtxOf } from '@charlie-labs/oclif-plugin-helpers';

import type { ContentResult } from '../../lib/contracts.js';
import { readFull } from '../../lib/operations.js';
import { DocsCommand } from '../utils/docs-command.js';

export default class Full extends DocsCommand {
  static override description =
    'Read the complete Charlie documentation corpus.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ];
  static override summary = 'Read the full documentation corpus';

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<ContentResult> {
    await this.parse(Full);
    return this.runContent(readFull, deps);
  }
}
