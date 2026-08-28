import { addDiagnostic, makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';

const DOCUMENT_FIELDS = new Set([
  'about',
  'purpose',
  'replacedBy',
  'reviewEvery',
  'status',
]);

type DocumentField = Readonly<{
  readonly line: number;
  readonly value: string;
}>;

type Frontmatter = Readonly<{
  readonly closingIndex: number;
  readonly fields: ReadonlyMap<string, DocumentField>;
}>;

export function validateDocument(
  relativePath: string,
  content: string
): readonly ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const lines = content.split(/\r?\n/u);
  const frontmatter = parseFrontmatter(relativePath, lines, diagnostics);
  if (frontmatter === undefined) {
    return diagnostics;
  }

  validateDocumentMetadata(relativePath, frontmatter.fields, diagnostics);
  validateDocumentBody(
    relativePath,
    lines.slice(frontmatter.closingIndex + 1),
    frontmatter.closingIndex + 1,
    diagnostics
  );
  return diagnostics;
}

function parseFrontmatter(
  relativePath: string,
  lines: readonly string[],
  diagnostics: ContentDiagnostic[]
): Frontmatter | undefined {
  if (lines[0]?.trim() !== '---') {
    diagnostics.push(
      makeDiagnostic({
        message: 'Markdown Docs require YAML frontmatter',
        path: relativePath,
        ruleId: 'FW-DOC-001',
        source: { column: 1, line: 1 },
      })
    );
    return undefined;
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === '---'
  );
  if (closingIndex < 0) {
    diagnostics.push(
      makeDiagnostic({
        message: 'frontmatter must have a closing --- delimiter',
        path: relativePath,
        ruleId: 'FW-DOC-001',
        source: { column: 1, line: 1 },
      })
    );
    return undefined;
  }

  return {
    closingIndex,
    fields: parseFrontmatterFields(
      relativePath,
      lines.slice(1, closingIndex),
      diagnostics
    ),
  };
}

function parseFrontmatterFields(
  relativePath: string,
  lines: readonly string[],
  diagnostics: ContentDiagnostic[]
): ReadonlyMap<string, DocumentField> {
  const fields = new Map<string, DocumentField>();
  for (const [index, line] of lines.entries()) {
    const entry = parseFrontmatterLine({
      diagnostics,
      fields,
      line,
      lineNumber: index + 2,
      relativePath,
    });
    if (entry !== undefined) {
      fields.set(entry.key, entry.field);
    }
  }
  return fields;
}

type FrontmatterLineContext = Readonly<{
  readonly diagnostics: ContentDiagnostic[];
  readonly fields: ReadonlyMap<string, DocumentField>;
  readonly line: string;
  readonly lineNumber: number;
  readonly relativePath: string;
}>;

type FrontmatterEntry = Readonly<{
  readonly field: DocumentField;
  readonly key: string;
}>;

function parseFrontmatterLine(
  context: FrontmatterLineContext
): FrontmatterEntry | undefined {
  if (context.line.trim() === '') {
    return undefined;
  }
  const match = /^(?<key>[A-Za-z][A-Za-z0-9-]*):\s*(?<value>.*)$/u.exec(
    context.line
  );
  const key = match?.groups?.key;
  const value = match?.groups?.value;
  if (key === undefined || value === undefined) {
    addDiagnostic(context.diagnostics, {
      message: 'frontmatter entries must use key: value syntax',
      path: context.relativePath,
      ruleId: 'FW-DOC-002',
      source: { column: 1, line: context.lineNumber },
    });
    return undefined;
  }
  if (context.fields.has(key)) {
    addDiagnostic(context.diagnostics, {
      field: key,
      message: `frontmatter field is duplicated: ${key}`,
      path: context.relativePath,
      ruleId: 'FW-DOC-002',
      source: { column: 1, line: context.lineNumber },
    });
    return undefined;
  }
  if (!DOCUMENT_FIELDS.has(key)) {
    addDiagnostic(context.diagnostics, {
      field: key,
      message: `frontmatter field is not supported: ${key}`,
      path: context.relativePath,
      ruleId: 'FW-DOC-002',
      source: { column: 1, line: context.lineNumber },
    });
  }
  return {
    field: { line: context.lineNumber, value: value.trim() },
    key,
  };
}

function validateDocumentMetadata(
  relativePath: string,
  fields: ReadonlyMap<string, DocumentField>,
  diagnostics: ContentDiagnostic[]
): void {
  validatePurpose(relativePath, fields, diagnostics);
  validateReviewEvery(relativePath, fields, diagnostics);
  validateStatus(relativePath, fields, diagnostics);
}

function validatePurpose(
  relativePath: string,
  fields: ReadonlyMap<string, DocumentField>,
  diagnostics: ContentDiagnostic[]
): void {
  const purpose = fields.get('purpose');
  if (purpose !== undefined && purpose.value !== '') {
    return;
  }
  diagnostics.push(
    makeDiagnostic({
      field: 'purpose',
      message: 'purpose is required',
      path: relativePath,
      ruleId: 'FW-DOC-003',
    })
  );
}

function validateReviewEvery(
  relativePath: string,
  fields: ReadonlyMap<string, DocumentField>,
  diagnostics: ContentDiagnostic[]
): void {
  const reviewEvery = fields.get('reviewEvery');
  if (
    reviewEvery !== undefined &&
    /^[1-9][0-9]*[dhmy]$/u.test(reviewEvery.value)
  ) {
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
  fields: ReadonlyMap<string, DocumentField>,
  diagnostics: ContentDiagnostic[]
): void {
  const status = fields.get('status');
  const replacedBy = fields.get('replacedBy');
  validateStatusValue(relativePath, status, diagnostics);
  if (status?.value === 'superseded' && (replacedBy?.value ?? '') === '') {
    diagnostics.push(
      makeDiagnostic({
        field: 'replacedBy',
        message: 'replacedBy is required for superseded Docs',
        path: relativePath,
        ruleId: 'FW-DOC-004',
        source: { column: 1, line: status.line },
      })
    );
  }
  if (status?.value !== 'superseded' && replacedBy !== undefined) {
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
}

function validateStatusValue(
  relativePath: string,
  status: DocumentField | undefined,
  diagnostics: ContentDiagnostic[]
): void {
  if (
    status === undefined ||
    status.value === 'deprecated' ||
    status.value === 'superseded'
  ) {
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
