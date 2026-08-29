import { type ExecCtxOf } from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import type { ContentResult } from '../../lib/contracts.js';
import { DocsInvocationError } from '../../lib/errors.js';
import { readPage } from '../../lib/operations.js';
import { DocsCommand } from '../utils/docs-command.js';

export default class Page extends DocsCommand {
  static override args = {
    path: Args.string({
      description:
        'Relative documentation path or URL on the Charlie docs origin',
      required: true,
    }),
  };
  static override description = 'Read one complete Charlie documentation page.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> /guides/tasks',
    '<%= config.bin %> <%= command.id %> https://charlie-v3.mintlify.site/guides/tasks.md --json',
  ];
  static override summary = 'Read one documentation page';

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<ContentResult> {
    const { args } = await this.parse(Page);
    if (args.path === '') {
      throw new DocsInvocationError('page expects exactly one argument.');
    }
    return this.runContent(
      (resolvedDeps) => readPage(args.path, resolvedDeps),
      deps
    );
  }
}
