import path from 'node:path';

import type { RepositoryPath } from '../../repository/contract.js';
import { normalizeRepositoryRelativePath } from '../../repository/path.js';
import { ExactSearchInvocationError } from './errors.js';
import { parseRipgrepArguments } from './parse.js';

const ENFORCED_OPTIONS = [
  '--no-config',
  '--no-follow',
  '--glob=!**/AGENTS.md',
  '--glob=!**/.agents/rules/**',
  '--glob=!**/.git/**',
] as const;

export type ExactSearchScope = Readonly<{
  readonly directories: readonly RepositoryPath[];
  readonly files: readonly RepositoryPath[];
  readonly searchPaths: readonly RepositoryPath[];
  readonly symbolicLinks: readonly RepositoryPath[];
}>;

export function prepareRipgrepArguments(
  rgArgs: readonly string[],
  scope: ExactSearchScope
): readonly string[] {
  const parsed = parseRipgrepArguments(rgArgs);
  const replacements = new Map<number, RepositoryPath>();
  for (const operand of parsed.pathOperands) {
    replacements.set(operand.index, validatePathOperand(operand.value, scope));
  }
  const normalizedArgs = rgArgs.map(
    (argument, index) => replacements.get(index) ?? argument
  );
  const policyArgs = insertPolicyArguments(
    normalizedArgs,
    parsed.delimiterIndex
  );
  return parsed.pathOperands.length === 0
    ? [...policyArgs, ...scope.searchPaths]
    : policyArgs;
}

function validatePathOperand(
  operand: string,
  scope: ExactSearchScope
): RepositoryPath {
  if (operand === '-' || path.isAbsolute(operand)) {
    throw invalidPath(operand);
  }
  let normalized: RepositoryPath;
  try {
    normalized = normalizeRepositoryRelativePath(operand);
  } catch {
    throw invalidPath(operand);
  }
  if (isProhibitedPath(normalized) || crossesSymbolicLink(normalized, scope)) {
    throw invalidPath(operand);
  }
  if (!isAdmittedPath(normalized, scope)) {
    throw new ExactSearchInvocationError(
      `ripgrep path escapes admitted Flywheel roots: ${operand}`
    );
  }
  return normalized;
}

function invalidPath(operand: string): ExactSearchInvocationError {
  return new ExactSearchInvocationError(
    `ripgrep path is not a repository-relative admitted path: ${operand}`
  );
}

function isAdmittedPath(
  candidate: RepositoryPath,
  scope: ExactSearchScope
): boolean {
  if (scope.files.includes(candidate)) {
    return true;
  }
  return scope.directories.some((root) => isWithin(root, candidate));
}

function isWithin(root: RepositoryPath, candidate: RepositoryPath): boolean {
  const relative = path.posix.relative(root, candidate);
  return relative === '' || (!relative.startsWith('../') && relative !== '..');
}

function crossesSymbolicLink(
  candidate: RepositoryPath,
  scope: ExactSearchScope
): boolean {
  return scope.symbolicLinks.some((link) => isWithin(link, candidate));
}

function isProhibitedPath(candidate: RepositoryPath): boolean {
  const segments = candidate.split('/');
  if (segments.includes('.git')) {
    return true;
  }
  if (segments.at(-1) === 'AGENTS.md') {
    return true;
  }
  return segments.some(
    (segment, index) => segment === '.agents' && segments[index + 1] === 'rules'
  );
}

function insertPolicyArguments(
  rgArgs: readonly string[],
  delimiterIndex: number | undefined
): readonly string[] {
  if (delimiterIndex === undefined) {
    return [...rgArgs, ...ENFORCED_OPTIONS];
  }
  return [
    ...rgArgs.slice(0, delimiterIndex),
    ...ENFORCED_OPTIONS,
    ...rgArgs.slice(delimiterIndex),
  ];
}
