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
import {
  formatDiagnostic,
  validateContent,
  type ContentValidationResult,
} from '../../../lib/content/validate.js';
import { resolveRepositoryPath } from '../../../lib/repository/path.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../../lib/runtime/deps.js';
import { ContentCommand } from '../../utils/content-command.js';
import { contentValidateFlags } from '../../utils/content-flags.js';

export default class Validate extends ContentCommand<
  | CfgFlags<typeof contentValidateFlags>
  | Deps<FlywheelDeps>
  | Result<ContentValidationResult>
> {
  static override args = {
    paths: Args.string({
      description: 'One or more repository-relative Flywheel paths',
      multiple: true,
      required: false,
    }),
  };
  static override flags = super.registerManifest(contentValidateFlags);
  static override summary = 'Validate the supported Flywheel content slice';
  static override description =
    'Run deterministic offline validation without formatting, repairing, or rewriting content.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> customer-wide/docs',
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

    const repositoryPath = resolveRepositoryPath({
      cwd: process.cwd(),
      ...(parsed['repository-path'] === undefined
        ? {}
        : { explicitPath: parsed['repository-path'] }),
    });
    const state = validationState(parsed);
    const result = await validateContent({
      filesystem: deps.filesystem,
      paths: extractValidationPaths(this.argv),
      process: deps.process,
      repositoryPath,
      ...(state === undefined ? {} : { state }),
    });
    const errors = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error'
    );
    if (result.diagnostics.length > 0) {
      if (!this.jsonEnabled()) {
        for (const diagnostic of result.diagnostics) {
          this.logWarn(formatDiagnostic(diagnostic));
        }
      }
      if (errors.length > 0) {
        throw new ContentValidationError(result.diagnostics);
      }
    }
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
      },
    };
  }
}

function validationState(
  parsed: Readonly<{
    readonly commit?: string | undefined;
    readonly staged?: boolean | undefined;
  }>
):
  | Readonly<{ readonly kind: 'index' }>
  | Readonly<{ readonly kind: 'commit'; readonly ref: string }>
  | undefined {
  if (parsed.staged === true) {
    return { kind: 'index' };
  }
  if (parsed.commit !== undefined) {
    return { kind: 'commit', ref: parsed.commit };
  }
  return undefined;
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
    if (argument === '--commit') {
      index += 1;
      continue;
    }
    if (argument.startsWith('--commit=')) {
      continue;
    }
    if (argument === '--staged') {
      continue;
    }
    if (argument.startsWith('-')) {
      continue;
    }
    paths.push(argument);
  }
  return paths;
}
