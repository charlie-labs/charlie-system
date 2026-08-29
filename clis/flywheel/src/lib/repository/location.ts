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

export function createSourceLocator(
  path: RepositoryPath,
  contents: string
): Readonly<{
  readonly atOffsets: (start: number, end?: number) => SourceLocation;
}> {
  const lineStarts = collectLineStarts(contents);
  return {
    atOffsets: (start, end = start) =>
      sourceLocation(
        path,
        positionAtOffset(contents, lineStarts, start),
        positionAtOffset(contents, lineStarts, end)
      ),
  };
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

function collectLineStarts(contents: string): readonly number[] {
  const starts = [0];
  for (let index = 0; index < contents.length; index += 1) {
    if (contents[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function positionAtOffset(
  contents: string,
  lineStarts: readonly number[],
  offset: number
): SourcePosition {
  const boundedOffset = Math.max(0, Math.min(offset, contents.length));
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const lineStart = lineStarts[middle];
    if (lineStart !== undefined && lineStart <= boundedOffset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return {
    column: boundedOffset - (lineStarts[low] ?? 0) + 1,
    line: low + 1,
  };
}
