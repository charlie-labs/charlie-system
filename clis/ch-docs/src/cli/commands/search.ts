import { type ExecCtxOf } from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import type { ContentResult } from '../../lib/contracts.js';
import { DocsInvocationError } from '../../lib/errors.js';
import { search } from '../../lib/operations.js';
import { DocsCommand } from '../utils/docs-command.js';

export default class Search extends DocsCommand {
  static override args = {
    query: Args.string({
      description: 'Documentation search query',
      multiple: true,
      required: true,
    }),
  };
  static override description =
    'Search current Charlie documentation for a topic.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> Tasks mailboxes',
    '<%= config.bin %> <%= command.id %> "worker agents" --json',
  ];
  static override summary = 'Search the documentation';

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<ContentResult> {
    const { args } = await this.parse(Search);
    const query = args.query.join(' ');
    if (query === '') {
      throw new DocsInvocationError('search requires an argument.');
    }
    return this.runContent((resolvedDeps) => search(query, resolvedDeps), deps);
  }
}
