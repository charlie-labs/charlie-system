import { type ExecCtxOf } from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import type { ContentResult } from '../../lib/contracts.js';
import { DocsInvocationError } from '../../lib/errors.js';
import { submitFeedback } from '../../lib/operations.js';
import { DocsCommand } from '../utils/docs-command.js';

export default class Feedback extends DocsCommand {
  static override args = {
    path: Args.string({
      description:
        'Relative documentation path or URL on the Charlie docs origin',
      required: true,
    }),
    feedback: Args.string({
      description: 'Feedback text',
      multiple: true,
      required: true,
    }),
  };
  static override description =
    'Submit write-capable feedback about one Charlie documentation page.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> /guides/tasks "The example is outdated"',
    '<%= config.bin %> <%= command.id %> /guides/tasks "The example" "is outdated" --json',
  ];
  static override summary = 'Submit documentation feedback';

  protected override async execute({
    deps,
  }: ExecCtxOf<this>): Promise<ContentResult> {
    const { args } = await this.parse(Feedback);
    const feedback = args.feedback.join(' ');
    if (feedback.trim() === '') {
      throw new DocsInvocationError(
        'feedback requires a page path and feedback text.'
      );
    }
    return this.runContent(
      (resolvedDeps) => submitFeedback(args.path, feedback, resolvedDeps),
      deps
    );
  }
}
