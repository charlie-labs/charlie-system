import type { RepositoryPath } from './contract.js';

export type SourcePosition = Readonly<{
  readonly column: number;
  readonly line: number;
}>;

export type SourceLocation = Readonly<{
  readonly end: SourcePosition;
  readonly path: RepositoryPath;
  readonly start: SourcePosition;
}>;

export function sourceLocation(
  path: RepositoryPath,
  start: SourcePosition,
  end: SourcePosition = start
): SourceLocation {
  return {
    end: normalizedPosition(end),
    path,
    start: normalizedPosition(start),
  };
}

export function wholeFileLocation(
  path: RepositoryPath,
  contents: string
): SourceLocation {
  const lines = contents.split(/\r?\n/u);
  const lastLine = lines.at(-1) ?? '';
  return sourceLocation(
    path,
    { column: 1, line: 1 },
    { column: lastLine.length + 1, line: lines.length }
  );
}

function normalizedPosition(position: SourcePosition): SourcePosition {
  if (!Number.isInteger(position.line) || position.line < 1) {
    throw new RangeError('source line must be a positive integer');
  }
  if (!Number.isInteger(position.column) || position.column < 1) {
    throw new RangeError('source column must be a positive integer');
  }
  return { column: position.column, line: position.line };
}
