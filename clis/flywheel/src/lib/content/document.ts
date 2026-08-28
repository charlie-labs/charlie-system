import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import {
  asString,
  parseFrontmatter,
  type ParsedFrontmatter,
  type YamlField,
} from './yaml.js';

const DOCUMENT_FIELDS = new Set([
  'about',
  'purpose',
  'replacedBy',
  'reviewEvery',
  'status',
]);

export function validateDocument(
  relativePath: string,
  content: string
): readonly ContentDiagnostic[] {
  const frontmatter = parseFrontmatter(relativePath, content, 'FW-DOC-001');
  if (frontmatter === undefined) {
    return [];
  }
  return [
    ...frontmatter.diagnostics,
    ...validateParsedDocument(relativePath, frontmatter),
  ];
}

function validateParsedDocument(
  relativePath: string,
  frontmatter: ParsedFrontmatter
): readonly ContentDiagnostic[] {
  if (frontmatter.closingLine < 0) {
    return [];
  }
  const diagnostics: ContentDiagnostic[] = [];
  validateFieldNames(relativePath, frontmatter.fields, diagnostics);
  validateDocumentMetadata(relativePath, frontmatter.fields, diagnostics);
  validateDocumentBody(
    relativePath,
    frontmatter.bodyLines,
    frontmatter.closingLine,
    diagnostics
  );
  return diagnostics;
}

function validateFieldNames(
  relativePath: string,
  fields: ReadonlyMap<string, YamlField>,
  diagnostics: ContentDiagnostic[]
): void {
  for (const field of fields.keys()) {
    if (DOCUMENT_FIELDS.has(field)) {
      continue;
    }
    diagnostics.push(
      makeDiagnostic({
        field,
        message: `frontmatter field is not supported: ${field}`,
        path: relativePath,
        ruleId: 'FW-DOC-002',
        source: {
          column: 1,
          line: fields.get(field)?.line ?? 1,
        },
      })
    );
  }
}

function validateDocumentMetadata(
  relativePath: string,
  fields: ReadonlyMap<string, YamlField>,
  diagnostics: ContentDiagnostic[]
): void {
  validatePurpose(relativePath, fields, diagnostics);
  validateReviewEvery(relativePath, fields, diagnostics);
  validateStatus(relativePath, fields, diagnostics);
}

function validatePurpose(
  relativePath: string,
  fields: ReadonlyMap<string, YamlField>,
  diagnostics: ContentDiagnostic[]
): void {
  const purpose = fields.get('purpose');
  if (typeof purpose?.value === 'string' && purpose.value.trim() !== '') {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'purpose',
      message: 'purpose is required',
      path: relativePath,
      ruleId: 'FW-DOC-003',
      ...(purpose === undefined
        ? {}
        : { source: { column: 1, line: purpose.line } }),
    })
  );
}

function validateReviewEvery(
  relativePath: string,
  fields: ReadonlyMap<string, YamlField>,
  diagnostics: ContentDiagnostic[]
): void {
  const reviewEvery = fields.get('reviewEvery');
  const value = asString(reviewEvery?.value);
  if (value !== undefined && /^[1-9][0-9]*[dhmy]$/u.test(value)) {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'reviewEvery',
      message: 'reviewEvery must be a positive duration such as 90d',
      path: relativePath,
      ruleId: 'FW-DOC-003',
      ...(reviewEvery === undefined
        ? {}
        : { source: { column: 1, line: reviewEvery.line } }),
    })
  );
}

function validateStatus(
  relativePath: string,
  fields: ReadonlyMap<string, YamlField>,
  diagnostics: ContentDiagnostic[]
): void {
  const status = fields.get('status');
  const replacedBy = fields.get('replacedBy');
  const statusValue = asString(status?.value);
  const replacedByValue = asString(replacedBy?.value);
  validateStatusField(relativePath, status, statusValue, diagnostics);
  if (statusValue === 'superseded') {
    validateSupersededStatus({
      diagnostics,
      relativePath,
      replacedBy,
      replacedByValue,
      status,
    });
    return;
  }
  validateReplacementField(relativePath, replacedBy, diagnostics);
}

function validateStatusField(
  relativePath: string,
  status: YamlField | undefined,
  statusValue: string | undefined,
  diagnostics: ContentDiagnostic[]
): void {
  if (status === undefined || isDocumentStatus(statusValue)) {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'status',
      message: 'status must be deprecated or superseded',
      path: relativePath,
      ruleId: 'FW-DOC-004',
      source: { column: 1, line: status.line },
    })
  );
}

function validateSupersededStatus(
  input: Readonly<{
    readonly diagnostics: ContentDiagnostic[];
    readonly relativePath: string;
    readonly replacedBy: YamlField | undefined;
    readonly replacedByValue: string | undefined;
    readonly status: YamlField | undefined;
  }>
): void {
  if ((input.replacedByValue ?? '') === '') {
    input.diagnostics.push(
      makeDiagnostic({
        field: 'replacedBy',
        message: 'replacedBy is required for superseded Docs',
        path: input.relativePath,
        ruleId: 'FW-DOC-004',
        source: { column: 1, line: input.status?.line ?? 1 },
      })
    );
  }
  if (input.replacedBy !== undefined && input.replacedByValue === undefined) {
    addInvalidReplacedByDiagnostic(
      input.relativePath,
      input.replacedBy,
      input.diagnostics
    );
  }
}

function validateReplacementField(
  relativePath: string,
  replacedBy: YamlField | undefined,
  diagnostics: ContentDiagnostic[]
): void {
  if (replacedBy === undefined) {
    return;
  }
  addInvalidReplacedByDiagnostic(relativePath, replacedBy, diagnostics);
}

function isDocumentStatus(value: string | undefined): boolean {
  return value === 'deprecated' || value === 'superseded';
}

function addInvalidReplacedByDiagnostic(
  relativePath: string,
  replacedBy: YamlField,
  diagnostics: ContentDiagnostic[]
): void {
  diagnostics.push(
    makeDiagnostic({
      field: 'replacedBy',
      message: 'replacedBy is only allowed for superseded Docs',
      path: relativePath,
      ruleId: 'FW-DOC-004',
      source: { column: 1, line: replacedBy.line },
    })
  );
}

function validateDocumentBody(
  relativePath: string,
  lines: readonly string[],
  lineOffset: number,
  diagnostics: ContentDiagnostic[]
): void {
  const headingIndex = lines.findIndex((line) => /^#\s+\S/u.test(line));
  if (headingIndex < 0) {
    diagnostics.push(
      makeDiagnostic({
        message: 'the first H1 heading is required',
        path: relativePath,
        ruleId: 'FW-DOC-005',
      })
    );
    return;
  }

  const firstContentIndex = lines
    .slice(headingIndex + 1)
    .findIndex((line) => line.trim() !== '');
  const firstContent =
    firstContentIndex < 0
      ? undefined
      : lines[headingIndex + 1 + firstContentIndex];
  if (firstContent !== undefined && !/^#{1,6}\s/u.test(firstContent)) {
    return;
  }
  const contentLine =
    firstContentIndex < 0
      ? lineOffset + headingIndex + 2
      : lineOffset + headingIndex + 2 + firstContentIndex;
  diagnostics.push(
    makeDiagnostic({
      message: 'the first paragraph after the H1 is required',
      path: relativePath,
      ruleId: 'FW-DOC-005',
      source: { column: 1, line: contentLine },
    })
  );
}
