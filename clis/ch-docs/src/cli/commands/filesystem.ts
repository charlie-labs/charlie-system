import { type ExecCtxOf } from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import type { ContentResult } from '../../lib/contracts.js';
import { DocsInvocationError } from '../../lib/errors.js';
import { readFilesystem } from '../../lib/operations.js';
import { DocsCommand } from '../utils/docs-command.js';

export default class Filesystem extends DocsCommand {
  static override args = {
    command: Args.string({
      description: 'Read-only documentation filesystem command',
      multiple: true,
      required: true,
    }),
  };
  static override description =
    'Run a supported read-only documentation filesystem command.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> rg -n "Tasks"',
    '<%= config.bin %> <%= command.id %> head -40 index.md --json',
  ];
  static override summary = 'Run a read-only filesystem command';

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<ContentResult> {
    const { args } = await this.parse(Filesystem);
    const command = args.command.join(' ');
    if (command === '') {
      throw new DocsInvocationError('filesystem requires an argument.');
    }
    return this.runContent(
      (resolvedDeps) => readFilesystem(command, resolvedDeps),
      deps
    );
  }
}
