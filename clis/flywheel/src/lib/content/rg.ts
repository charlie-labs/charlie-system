import path from 'node:path';

import type {
  AsyncFileSystem,
  ProcessResult,
  ProcessRunner,
} from '../runtime/deps.js';
import { ContentInvocationError, ContentOperationalError } from './errors.js';
import {
  discoverContentSearchRoots,
  toRepositoryRelative,
  type ContentSelection,
} from './roots.js';

const RIPGREP_VALUE_OPTIONS = new Set([
  '--after-context',
  '--before-context',
  '--color',
  '--colors',
  '--context',
  '--encoding',
  '--glob',
  '--iglob',
  '--max-columns',
  '--max-count',
  '--path-separator',
  '--pre',
  '--pre-glob',
  '--regexp',
  '--sort',
  '--sortr',
  '--threads',
  '--type',
  '--type-add',
  '--type-clear',
  '--type-not',
  '-A',
  '-B',
  '-C',
  '-e',
  '-f',
  '-g',
  '-j',
  '-m',
  '-t',
]);

export type ContentRgInput = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly process: ProcessRunner;
  readonly rgArgs: readonly string[];
  readonly selection: ContentSelection;
}>;

export async function runContentRg(
  input: ContentRgInput
): Promise<ProcessResult> {
  rejectJsonArguments(input.rgArgs);
  const roots = await discoverContentSearchRoots(
    input.filesystem,
    input.selection
  );
  const pathOperands = findPathOperands(input.rgArgs);
  validatePathOperands(input.selection.repositoryPath, roots, pathOperands);

  if (roots.length === 0) {
    return {
      exitCode: 1,
      stderr: '',
      stdout: '',
    };
  }

  const args =
    pathOperands.length === 0
      ? [
          ...input.rgArgs,
          ...roots.map((root) =>
            toRepositoryRelative(input.selection.repositoryPath, root)
          ),
        ]
      : [...input.rgArgs];
  try {
    return await input.process.run('rg', args, {
      cwd: input.selection.repositoryPath,
    });
  } catch (error) {
    throw new ContentOperationalError('ripgrep could not be started', {
      cause: error,
    });
  }
}

function findPathOperands(rgArgs: readonly string[]): readonly string[] {
  const state: RgArgumentState = {
    operands: [],
    optionsDone: false,
    patternSeen: false,
  };

  for (let index = 0; index < rgArgs.length; index += 1) {
    const argument = rgArgs[index];
    if (argument === undefined) {
      continue;
    }
    index += consumeRgArgument(argument, state);
  }

  return state.operands;
}

function rejectJsonArguments(rgArgs: readonly string[]): void {
  if (rgArgs.some((argument) => argument === '--json')) {
    throw new ContentInvocationError(
      'content rg does not support --json before or after the delimiter'
    );
  }
}

function validatePathOperands(
  repositoryPath: string,
  roots: readonly string[],
  pathOperands: readonly string[]
): void {
  for (const operand of pathOperands) {
    if (operand === '-' || path.isAbsolute(operand) || operand.includes('\\')) {
      throw new ContentInvocationError(
        `ripgrep path is not a repository-relative admitted path: ${operand}`
      );
    }

    const candidate = path.resolve(repositoryPath, operand);
    if (
      !roots.some((root) => {
        const relative = path.relative(root, candidate);
        return (
          relative === '' ||
          (!relative.startsWith(`..${path.sep}`) &&
            relative !== '..' &&
            !path.isAbsolute(relative))
        );
      })
    ) {
      throw new ContentInvocationError(
        `ripgrep path escapes admitted Flywheel roots: ${operand}`
      );
    }
  }
}

function hasInlineValue(argument: string): boolean {
  if (!argument.startsWith('--')) {
    return (
      argument.length > 2 && RIPGREP_VALUE_OPTIONS.has(argument.slice(0, 2))
    );
  }

  return argument.includes('=');
}

function isPatternOption(argument: string): boolean {
  return argument === '-e' || argument.startsWith('--regexp=');
}

type RgArgumentState = {
  readonly operands: string[];
  optionsDone: boolean;
  patternSeen: boolean;
};

function consumeRgArgument(argument: string, state: RgArgumentState): number {
  if (argument === '--') {
    state.optionsDone = true;
    return 0;
  }
  if (state.optionsDone) {
    addPatternOrOperand(argument, state);
    return 0;
  }
  if (!argument.startsWith('-')) {
    addPatternOrOperand(argument, state);
    return 0;
  }
  if (hasInlineValue(argument)) {
    state.patternSeen ||= isPatternOption(argument);
    return 0;
  }
  if (RIPGREP_VALUE_OPTIONS.has(argument)) {
    state.patternSeen ||= argument === '-e' || argument === '--regexp';
    return 1;
  }
  return 0;
}

function addPatternOrOperand(argument: string, state: RgArgumentState): void {
  if (!state.patternSeen) {
    state.patternSeen = true;
    return;
  }
  state.operands.push(argument);
}
