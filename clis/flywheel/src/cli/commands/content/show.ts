import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import {
  ContentOperationalError,
  ContentShowError,
} from '../../../lib/content/errors.js';
import { runContentShow } from '../../../lib/content/show.js';
import type { ArtifactInspection } from '../../../lib/retrieval/inspection/contract.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import {
  renderArtifactInspection,
  renderProblems,
} from '../../output/artifact.js';
import { ContentCommand } from '../../utils/content-command.js';
import { contentShowFlags } from '../../utils/content-flags.js';
import { buildFlywheelRuntime } from '../../utils/runtime.js';

export default class Show extends ContentCommand<
  | CfgFlags<typeof contentShowFlags>
  | Deps<FlywheelDeps>
  | Result<ArtifactInspection>
> {
  static override args = {
    target: Args.string({
      description: 'Inspectable Flywheel target ID, alias, or path',
      required: true,
    }),
  };
  static override flags = super.registerManifest(contentShowFlags);
  static override summary = 'Show one compiled Flywheel artifact';
  static override description =
    'Compile accepted Flywheel files once and inspect a known local artifact or document section without fetching external content.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> customer-wide/docs/guide.md',
    '<%= config.bin %> <%= command.id %> customer-wide/docs/guide.md#operations',
    '<%= config.bin %> <%= command.id %> component:default/api --json',
  ];

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<ArtifactInspection> {
    if (deps === undefined) {
      throw new ContentOperationalError(
        'content show dependencies were not provided'
      );
    }
    const target = this.argv[0];
    if (target === undefined) {
      throw new ContentOperationalError('content show requires a target');
    }
    const runtime = buildFlywheelRuntime({
      cwd: process.cwd(),
      deps,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const inspection = await runContentShow({
      filesystem: runtime.deps.filesystem,
      repositoryPath: runtime.repositoryPath,
      target,
    });
    if (inspection.kind !== 'artifact') {
      this.renderFailure(inspection);
      throw new ContentShowError(inspection);
    }
    if (!this.jsonEnabled()) {
      process.stdout.write(
        `${renderArtifactInspection(inspection).trimEnd()}\n`
      );
    }
    return inspection;
  }

  protected override toErrorJson(error: unknown) {
    const result = super.toErrorJson(error);
    return error instanceof ContentShowError
      ? {
          ...result,
          error: { ...result.error, inspection: error.inspection },
        }
      : result;
  }

  private renderFailure(
    inspection: Exclude<ArtifactInspection, { readonly kind: 'artifact' }>
  ): void {
    if (this.jsonEnabled() || inspection.kind !== 'unparsed') return;
    const output = renderProblems(inspection.problems);
    if (output !== '') process.stderr.write(`${output}\n`);
  }
}
