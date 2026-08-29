import { ExactSearchInvocationError } from './errors.js';

const RIPGREP_VALUE_OPTIONS = new Set([
  '--after-context',
  '--before-context',
  '--color',
  '--colors',
  '--context',
  '--context-separator',
  '--dfa-size-limit',
  '--encoding',
  '--engine',
  '--field-context-separator',
  '--field-match-separator',
  '--generate',
  '--glob',
  '--hostname-bin',
  '--hyperlink-format',
  '--iglob',
  '--max-columns',
  '--max-count',
  '--max-depth',
  '--max-filesize',
  '--path-separator',
  '--pre',
  '--pre-glob',
  '--regex-size-limit',
  '--regexp',
  '--replace',
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
  '-E',
  '-M',
  '-T',
  '-d',
  '-e',
  '-g',
  '-j',
  '-m',
  '-r',
  '-t',
]);

const PATTERN_OPTIONS = new Set(['--regexp', '-e']);
const INFORMATIONAL_OPTIONS = new Set([
  '--help',
  '--pcre2-version',
  '--type-list',
  '--version',
  '-V',
  '-h',
]);

type RipgrepPathOperand = Readonly<{
  readonly index: number;
  readonly value: string;
}>;

export type ParsedRipgrepArguments = Readonly<{
  readonly delimiterIndex: number | undefined;
  readonly pathOperands: readonly RipgrepPathOperand[];
}>;

type ArgumentState = {
  delimiterIndex: number | undefined;
  readonly filesMode: boolean;
  optionsDone: boolean;
  readonly pathOperands: RipgrepPathOperand[];
  patternSeen: boolean;
};

export function parseRipgrepArguments(
  rgArgs: readonly string[]
): ParsedRipgrepArguments {
  rejectJsonArguments(rgArgs);
  const state: ArgumentState = {
    delimiterIndex: undefined,
    filesMode: usesFilesMode(rgArgs),
    optionsDone: false,
    pathOperands: [],
    patternSeen: false,
  };
  for (let index = 0; index < rgArgs.length; index += 1) {
    const argument = rgArgs[index];
    if (argument !== undefined) {
      index += consumeArgument(argument, index, state);
    }
  }
  return {
    delimiterIndex: state.delimiterIndex,
    pathOperands: state.pathOperands,
  };
}

function consumeArgument(
  argument: string,
  index: number,
  state: ArgumentState
): number {
  if (argument === '--' && !state.optionsDone) {
    state.delimiterIndex = index;
    state.optionsDone = true;
    return 0;
  }
  if (state.optionsDone || !argument.startsWith('-')) {
    addPatternOrPath(argument, index, state);
    return 0;
  }
  rejectUnsafeOption(argument);
  rejectClusteredShortOption(argument);
  if (hasInlineValue(argument)) {
    state.patternSeen ||= isPatternOption(argument);
    return 0;
  }
  if (RIPGREP_VALUE_OPTIONS.has(argument)) {
    state.patternSeen ||= PATTERN_OPTIONS.has(argument);
    return 1;
  }
  return 0;
}

function addPatternOrPath(
  argument: string,
  index: number,
  state: ArgumentState
): void {
  if (!state.filesMode && !state.patternSeen) {
    state.patternSeen = true;
    return;
  }
  state.pathOperands.push({ index, value: argument });
}

function usesFilesMode(rgArgs: readonly string[]): boolean {
  let optionsDone = false;
  for (let index = 0; index < rgArgs.length; index += 1) {
    const argument = rgArgs[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === '--') {
      optionsDone = true;
    } else if (!optionsDone && argument === '--files') {
      return true;
    } else if (!optionsDone && consumesFollowingValue(argument)) {
      index += 1;
    }
  }
  return false;
}

function consumesFollowingValue(argument: string): boolean {
  return !hasInlineValue(argument) && RIPGREP_VALUE_OPTIONS.has(argument);
}

function hasInlineValue(argument: string): boolean {
  if (argument.startsWith('--')) {
    return argument.includes('=');
  }
  return argument.length > 2 && RIPGREP_VALUE_OPTIONS.has(argument.slice(0, 2));
}

function isPatternOption(argument: string): boolean {
  if (argument.startsWith('--')) {
    return argument.startsWith('--regexp=');
  }
  return argument.startsWith('-e');
}

function rejectUnsafeOption(argument: string): void {
  if (argument === '--follow' || argument === '-L') {
    throw new ExactSearchInvocationError(
      'content rg does not permit ripgrep to follow symbolic links'
    );
  }
  if (isCommandOption(argument)) {
    throw new ExactSearchInvocationError(
      `content rg does not permit ripgrep command execution: ${argument}`
    );
  }
  if (isFileBackedOption(argument)) {
    throw new ExactSearchInvocationError(
      `content rg does not permit ripgrep to read option values from files: ${argument}`
    );
  }
  if (isInformationalOption(argument)) {
    throw new ExactSearchInvocationError(
      `content rg does not support ripgrep informational option: ${argument}`
    );
  }
}

function isCommandOption(argument: string): boolean {
  return (
    argument === '-z' ||
    argument === '--search-zip' ||
    argument.startsWith('--search-zip=') ||
    argument === '--pre' ||
    argument.startsWith('--pre=') ||
    argument === '--hostname-bin' ||
    argument.startsWith('--hostname-bin=')
  );
}

function isFileBackedOption(argument: string): boolean {
  return (
    argument.startsWith('-f') ||
    argument === '--file' ||
    argument.startsWith('--file=') ||
    argument === '--ignore-file' ||
    argument.startsWith('--ignore-file=')
  );
}

function rejectClusteredShortOption(argument: string): void {
  if (
    argument.length > 2 &&
    argument.startsWith('-') &&
    !argument.startsWith('--') &&
    !hasInlineValue(argument)
  ) {
    throw new ExactSearchInvocationError(
      `content rg does not support clustered ripgrep short options: ${argument}`
    );
  }
}

function isInformationalOption(argument: string): boolean {
  return (
    INFORMATIONAL_OPTIONS.has(argument) ||
    argument === '--generate' ||
    argument.startsWith('--generate=')
  );
}

function rejectJsonArguments(rgArgs: readonly string[]): void {
  if (
    rgArgs.some(
      (argument) => argument === '--json' || argument.startsWith('--json=')
    )
  ) {
    throw new ExactSearchInvocationError(
      'content rg does not support --json before or after the delimiter'
    );
  }
}
