import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import {
  ContentOperationalError,
  ContentRelatedError,
} from '../../../lib/content/errors.js';
import { runContentRelated } from '../../../lib/content/related.js';
import type { RelatedResult } from '../../../lib/retrieval/related/contract.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { renderRelatedResult } from '../../output/related.js';
import { ContentCommand } from '../../utils/content-command.js';
import { contentRelatedFlags } from '../../utils/content-flags.js';
import { buildFlywheelRuntime } from '../../utils/runtime.js';

export default class Related extends ContentCommand<
  | CfgFlags<typeof contentRelatedFlags>
  | Deps<FlywheelDeps>
  | Result<RelatedResult>
> {
  static override args = {
    target: Args.string({
      description: 'Known Flywheel graph target ID, alias, or path',
      required: true,
    }),
  };
  static override description =
    'Compile the repository graph once and traverse its local incoming and outgoing relationships without fetching external content.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> customer-wide/docs/guide.md',
    '<%= config.bin %> <%= command.id %> component:default/api --json',
  ];
  static override flags = super.registerManifest(contentRelatedFlags);
  static override summary = 'Traverse relationships around a known target';

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<RelatedResult> {
    if (deps === undefined) {
      throw new ContentOperationalError(
        'content related dependencies were not provided'
      );
    }
    const target = this.argv[0];
    if (target === undefined) {
      throw new ContentOperationalError('content related requires a target');
    }
    const runtime = buildFlywheelRuntime({
      cwd: process.cwd(),
      deps,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const result = await runContentRelated({
      filesystem: runtime.deps.filesystem,
      repositoryPath: runtime.repositoryPath,
      target,
    });
    if (result.kind !== 'related') throw new ContentRelatedError(result);
    if (!this.jsonEnabled()) {
      process.stdout.write(`${renderRelatedResult(result).trimEnd()}\n`);
    }
    return result;
  }

  protected override toErrorJson(error: unknown) {
    const result = super.toErrorJson(error);
    return error instanceof ContentRelatedError
      ? { ...result, error: { ...result.error, result: error.result } }
      : result;
  }
}
