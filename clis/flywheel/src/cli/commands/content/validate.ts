import {
  type CfgFlags,
  type Deps,
  type ExecCtxOf,
  type Result,
} from '@charlie-labs/oclif-plugin-helpers';
import { Args } from '@oclif/core';

import {
  ContentOperationalError,
  ContentValidationError,
} from '../../../lib/content/errors.js';
import { runContentValidation } from '../../../lib/content/validate.js';
import type { ContentValidationResult } from '../../../lib/content/validation-contract.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { formatValidationDiagnostic } from '../../output/validation.js';
import { ContentCommand } from '../../utils/content-command.js';
import { contentValidateFlags } from '../../utils/content-flags.js';
import { buildFlywheelRuntime } from '../../utils/runtime.js';

export default class Validate extends ContentCommand<
  | CfgFlags<typeof contentValidateFlags>
  | Deps<FlywheelDeps>
  | Result<ContentValidationResult>
> {
  static override args = {
    paths: Args.string({
      description: 'One or more paths relative to the Flywheel repository',
      multiple: true,
      required: false,
    }),
  };
  static override flags = super.registerManifest(contentValidateFlags);
  static override summary = 'Validate the compiled Flywheel repository';
  static override description =
    'Compile and assess Flywheel artifacts, references, relationships, and Flywheel repository invariants without formatting, repairing, or rewriting content.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> customer-wide/docs',
    '<%= config.bin %> <%= command.id %> --staged --json',
    '<%= config.bin %> <%= command.id %> --json',
  ];

  static override buildDeps(): FlywheelDeps {
    return createFlywheelDeps();
  }

  protected override async execute({
    parsed,
    deps,
  }: ExecCtxOf<this>): Promise<ContentValidationResult> {
    if (deps === undefined) {
      throw new ContentOperationalError(
        'content validate dependencies were not provided'
      );
    }

    const runtime = buildFlywheelRuntime({
      cwd: process.cwd(),
      deps,
      ...(parsed['repository-path'] === undefined
        ? {}
        : { repositoryPath: parsed['repository-path'] }),
    });
    const result = await runContentValidation({
      filesystem: runtime.deps.filesystem,
      paths: extractValidationPaths(this.argv),
      process: runtime.deps.process,
      repositoryPath: runtime.repositoryPath,
      staged: parsed.staged,
    });
    if (!this.jsonEnabled()) {
      for (const diagnostic of result.diagnostics) {
        this.logWarn(formatValidationDiagnostic(diagnostic));
      }
    }
    if (result.status !== 'valid') throw new ContentValidationError(result);
    this.logInfo(`validated ${result.filesChecked} content file(s)`);
    return result;
  }

  protected override toErrorJson(error: unknown) {
    const result = super.toErrorJson(error);
    if (!(error instanceof ContentValidationError)) {
      return result;
    }

    return {
      ...result,
      error: {
        ...result.error,
        diagnostics: error.diagnostics,
        filesChecked: error.result.filesChecked,
        status: error.result.status,
      },
    };
  }
}

function extractValidationPaths(argv: readonly string[]): readonly string[] {
  const paths: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === '--json') {
      continue;
    }
    if (argument === '--repository-path') {
      index += 1;
      continue;
    }
    if (argument.startsWith('--repository-path=')) {
      continue;
    }
    if (argument.startsWith('-')) {
      continue;
    }
    paths.push(argument);
  }
  return paths;
}
