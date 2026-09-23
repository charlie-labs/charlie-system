import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import {
  runKnowledgeValidation,
  type KnowledgeValidationResult,
} from '../../../lib/knowledge/operations.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { KnowledgeOperationalError } from '../../errors/knowledge-errors.js';
import { KnowledgeValidationError } from '../../errors/knowledge-validation-error.js';
import { formatValidationDiagnostic } from '../../output/validation.js';
import { KnowledgeCommand } from '../../utils/knowledge-command.js';
import { knowledgeRepositoryFlags } from '../../utils/knowledge-flags.js';
import { buildFlywheelRuntime } from '../../utils/runtime.js';

export default class Validate extends KnowledgeCommand<
  | CfgFlags<typeof knowledgeRepositoryFlags>
  | Deps<FlywheelDeps>
  | Result<KnowledgeValidationResult>
> {
  static override args = {
    paths: Args.string({
      description: 'One or more Knowledge paths relative to the repository',
      multiple: true,
      required: false,
    }),
  };
  static override flags = super.registerManifest(knowledgeRepositoryFlags);
  static override summary = 'Validate Knowledge and review state';
  static override description =
    'Validate Docs, Catalog entities, relationships, and the local review manifest without changing the repository.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> customer-wide/docs --json',
  ];

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    deps,
    parsed,
  }: ExecCtxOf<this>): Promise<KnowledgeValidationResult> {
    if (deps === undefined)
      throw new KnowledgeOperationalError(
        'knowledge validate dependencies were not provided'
      );
    const { args } = await this.parse(Validate);
    const runtime = buildFlywheelRuntime({
      cwd: process.cwd(),
      deps,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const result = await runKnowledgeValidation({
      filesystem: runtime.deps.filesystem,
      paths: args.paths ?? [],
      repositoryPath: runtime.repositoryPath,
    });
    if (!this.jsonEnabled()) {
      for (const diagnostic of result.diagnostics)
        this.logWarn(formatValidationDiagnostic(diagnostic));
    }
    if (result.status !== 'valid') throw new KnowledgeValidationError(result);
    this.logInfo(`validated ${result.filesChecked} Knowledge file(s)`);
    return result;
  }

  protected override toErrorJson(error: unknown) {
    const result = super.toErrorJson(error);
    return error instanceof KnowledgeValidationError
      ? {
          ...result,
          error: {
            ...result.error,
            diagnostics: error.result.diagnostics,
            filesChecked: error.result.filesChecked,
            status: error.result.status,
          },
        }
      : result;
  }
}
