import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import {
  type ReviewRecord,
  validateReviewRecords,
} from './review-validation.js';

type ReviewResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly records: readonly ReviewRecord[];
}>;

type RecordField = Readonly<{ readonly line: number; readonly value: string }>;

const REVIEW_FIELDS = new Set([
  'contentHash',
  'reviewedAt',
  'rootTaskId',
  'target',
]);

export function parseReviewManifest(
  relativePath: string,
  content: string
): ReviewResult {
  const diagnostics: ContentDiagnostic[] = [];
  const lines = content.split(/\r?\n/u);
  validateTopLevelFields(relativePath, lines, diagnostics);
  validateSchemaVersion(relativePath, lines, diagnostics);
  const sectionIndex = findRecordSection(lines);
  if (sectionIndex < 0) {
    diagnostics.push(
      makeDiagnostic({
        message: 'review manifest must contain a reviews list',
        path: relativePath,
        ruleId: 'FW-REVIEW-001',
      })
    );
    return { diagnostics, records: [] };
  }
  const records = parseRecords(relativePath, lines, sectionIndex, diagnostics);
  validateReviewRecords(relativePath, records, diagnostics);
  return { diagnostics, records };
}

function validateSchemaVersion(
  relativePath: string,
  lines: readonly string[],
  diagnostics: ContentDiagnostic[]
): void {
  const schemaLine = lines.findIndex((line) =>
    /^schemaVersion:\s*/u.test(line)
  );
  const schemaValue =
    schemaLine < 0
      ? undefined
      : lines[schemaLine]
          ?.replace(/^schemaVersion:\s*/u, '')
          .replace(/\s+#.*$/u, '')
          .trim();
  if (schemaValue === '1') {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'schemaVersion',
      message: 'review manifest schemaVersion must be 1',
      path: relativePath,
      ruleId: 'FW-REVIEW-001',
    })
  );
}

function validateTopLevelFields(
  relativePath: string,
  lines: readonly string[],
  diagnostics: ContentDiagnostic[]
): void {
  const seenFields = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '' || line.trimStart() !== line) {
      continue;
    }
    const key = /^([A-Za-z][A-Za-z0-9]*):/u.exec(line)?.[1];
    if (key === 'schemaVersion' || key === 'reviews') {
      if (seenFields.has(key)) {
        diagnostics.push(
          makeDiagnostic({
            field: key,
            message: `review manifest field is duplicated: ${key}`,
            path: relativePath,
            ruleId: 'FW-REVIEW-001',
            source: { column: 1, line: index + 1 },
          })
        );
      } else {
        seenFields.add(key);
      }
      continue;
    }
    diagnostics.push(
      makeDiagnostic({
        ...(key === undefined ? {} : { field: key }),
        message:
          key === undefined
            ? 'review manifest entries must use key: value syntax'
            : `review manifest field is not supported: ${key}`,
        path: relativePath,
        ruleId: 'FW-REVIEW-001',
        source: { column: 1, line: index + 1 },
      })
    );
  }
}

function findRecordSection(lines: readonly string[]): number {
  return lines.findIndex((line) => /^reviews:\s*$/u.test(line));
}

function parseRecords(
  relativePath: string,
  lines: readonly string[],
  sectionIndex: number,
  diagnostics: ContentDiagnostic[]
): readonly ReviewRecord[] {
  const records: ReviewRecord[] = [];
  let current: Record<string, RecordField> | undefined;
  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }
    if (line.trim() === '') {
      continue;
    }
    if (line.trimStart() === line) {
      if (line.trimStart().startsWith('-')) {
        addReviewLineDiagnostic(
          {
            current,
            diagnostics,
            line,
            lineNumber: index + 1,
            path: relativePath,
            records,
          },
          'review list items must be indented beneath reviews'
        );
      }
      break;
    }
    if (line.length - line.trimStart().length < 2) {
      addReviewLineDiagnostic(
        {
          current,
          diagnostics,
          line,
          lineNumber: index + 1,
          path: relativePath,
          records,
        },
        'review records must be indented beneath reviews'
      );
      continue;
    }
    current = parseRecordEntry({
      current,
      diagnostics,
      line,
      lineNumber: index + 1,
      path: relativePath,
      records,
    });
  }
  if (current !== undefined) {
    records.push(toRecord(current));
  }
  return records;
}

type RecordEntryContext = Readonly<{
  readonly current: Record<string, RecordField> | undefined;
  readonly diagnostics: ContentDiagnostic[];
  readonly line: string;
  readonly lineNumber: number;
  readonly path: string;
  readonly records: ReviewRecord[];
}>;

function parseRecordEntry(
  context: RecordEntryContext
): Record<string, RecordField> | undefined {
  const parsed = parseRecordLine(context.line);
  const current = startRecord(parsed, context.current, context.records);
  if (
    current === undefined ||
    parsed.key === undefined ||
    parsed.value === undefined
  ) {
    addReviewLineDiagnostic(
      context,
      'review records must use key: value entries'
    );
    return current;
  }
  if (!REVIEW_FIELDS.has(parsed.key)) {
    addReviewLineDiagnostic(
      context,
      `review field is not supported: ${parsed.key}`,
      parsed.key
    );
    return current;
  }
  if (current[parsed.key] !== undefined) {
    addReviewLineDiagnostic(
      context,
      `review field is duplicated: ${parsed.key}`,
      parsed.key
    );
    return current;
  }
  current[parsed.key] = {
    line: context.lineNumber,
    value: unquote(parsed.value),
  };
  return current;
}

function addReviewLineDiagnostic(
  context: RecordEntryContext,
  message: string,
  field?: string
): void {
  context.diagnostics.push(
    makeDiagnostic({
      ...(field === undefined ? {} : { field }),
      message,
      path: context.path,
      ruleId: 'FW-REVIEW-001',
      source: { column: 1, line: context.lineNumber },
    })
  );
}

function startRecord(
  parsed: ParsedRecordLine,
  current: Record<string, RecordField> | undefined,
  records: ReviewRecord[]
): Record<string, RecordField> | undefined {
  if (!parsed.item) {
    return current;
  }
  if (current !== undefined) {
    records.push(toRecord(current));
  }
  return {};
}

type ParsedRecordLine = Readonly<{
  readonly item: boolean;
  readonly key?: string;
  readonly value?: string;
}>;

function parseRecordLine(line: string): ParsedRecordLine {
  const item = /^\s*-\s*(?<key>[A-Za-z][A-Za-z0-9]*):\s*(?<value>.*)$/u.exec(
    line
  );
  return item === null ? parseFieldLine(line) : parseMatchedLine(item, true);
}

function parseFieldLine(line: string): ParsedRecordLine {
  const field = /^\s+(?<key>[A-Za-z][A-Za-z0-9]*):\s*(?<value>.*)$/u.exec(line);
  return field === null ? { item: false } : parseMatchedLine(field, false);
}

function parseMatchedLine(
  match: RegExpExecArray,
  item: boolean
): ParsedRecordLine {
  const key = match.groups?.key;
  const value = match.groups?.value;
  return {
    item,
    ...(key === undefined ? {} : { key }),
    ...(value === undefined ? {} : { value }),
  };
}

function toRecord(fields: Readonly<Record<string, RecordField>>): ReviewRecord {
  const target = fields.target;
  return {
    line: target?.line ?? 1,
    ...(fields.contentHash === undefined
      ? {}
      : { contentHash: fields.contentHash.value }),
    ...(fields.reviewedAt === undefined
      ? {}
      : { reviewedAt: fields.reviewedAt.value }),
    ...(fields.rootTaskId === undefined
      ? {}
      : { rootTaskId: fields.rootTaskId.value }),
    ...(target === undefined ? {} : { target: target.value }),
  };
}

function unquote(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return quoted ? value.slice(1, -1) : value;
}
