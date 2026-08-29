import { type ExecCtxOf } from '@charlie-labs/oclif-plugin-helpers';

import type { ContentResult } from '../../../lib/contracts.js';
import { readIndex } from '../../../lib/operations.js';
import { DocsCommand } from '../../utils/docs-command.js';

export default class Index extends DocsCommand {
  static override description = 'Read the live Charlie documentation index.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ];
  static override summary = 'Read the documentation index';

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<ContentResult> {
    await this.parse(Index);
    return this.runContent(readIndex, deps);
  }
}
