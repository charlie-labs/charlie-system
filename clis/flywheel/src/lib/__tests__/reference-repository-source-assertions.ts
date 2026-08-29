import { expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  KnowledgeSourceUnit,
  KnowledgeStructuralKind,
} from '../retrieval/corpus/contract.js';
import type { SourceUnitExpectation } from './fixtures/reference-repository-types.js';

export async function expectSourceUnits(
  units: readonly KnowledgeSourceUnit[],
  repositoryPath: string,
  expectations: readonly SourceUnitExpectation[],
  expectedCount?: number
): Promise<void> {
  if (expectedCount !== undefined) {
    expect(units).toHaveLength(expectedCount);
  }
  await Promise.all(
    expectations.map(async (expectation) => {
      const candidates = units.filter(
        (candidate) =>
          candidate.structuralKind === expectation.structuralKind &&
          candidate.source.path === expectation.source.path &&
          sameHeadingPath(candidate.headingPath, expectation.headingPath)
      );
      expect(candidates).toHaveLength(1);
      const unit = candidates[0];
      if (unit === undefined) return;
      const canonical = await readCanonicalFragment(
        repositoryPath,
        expectation
      );
      expect(unit.citationKeys).toEqual(expectation.citationKeys);
      expect(unit.source).toEqual(canonical.source);
      expect(unit.authoredText).toBe(canonical.text);
    })
  );
}

function sameHeadingPath(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((heading, index) => heading === expected[index])
  );
}

async function readCanonicalFragment(
  repositoryPath: string,
  expectation: SourceUnitExpectation
): Promise<
  Readonly<{
    readonly source: KnowledgeSourceUnit['source'];
    readonly text: string;
  }>
> {
  const bytes = await readFile(
    path.join(repositoryPath, expectation.source.path)
  );
  const contents = new TextDecoder().decode(bytes);
  const lines = contents.split(/\r?\n/u);
  const start = expectation.source.line - 1;
  const end = expectation.source.endLine;
  const selectedLines = lines.slice(start, end);
  if (selectedLines.length !== end - start) {
    throw new Error(
      `fixture source range is outside canonical file: ${expectation.source.path}`
    );
  }
  const lastLine = selectedLines.at(-1) ?? '';
  expect(expectation.source.column).toBe(1);
  expect(expectation.source.endColumn).toBe(lastLine.length + 1);
  return {
    source: {
      end: {
        column: expectation.source.endColumn,
        line: expectation.source.endLine,
      },
      path: expectation.source.path,
      start: {
        column: expectation.source.column,
        line: expectation.source.line,
      },
    },
    text: canonicalFragmentText(selectedLines, expectation.structuralKind),
  };
}

function canonicalFragmentText(
  lines: readonly string[],
  structuralKind: KnowledgeStructuralKind
): string {
  if (structuralKind !== 'table') return lines.join('\n');
  const rows = lines.map((line) => canonicalTableRow(line));
  const header = rows[0] ?? [];
  return [header, header.map(() => '---'), ...rows.slice(2)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function canonicalTableRow(line: string): readonly string[] {
  const trimmed = line.trim();
  const withoutLeading = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutTrailing = withoutLeading.endsWith('|')
    ? withoutLeading.slice(0, -1)
    : withoutLeading;
  return withoutTrailing.split('|').map((cell) => cell.trim());
}
