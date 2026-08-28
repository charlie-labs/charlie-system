import path from 'node:path';

import type { AuthoredReference } from './artifact-types.js';
import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import { asStringList, type ParsedFrontmatter } from './yaml.js';

type MarkdownReferenceResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly references: readonly AuthoredReference[];
}>;

type MarkdownScanState = {
  readonly definitions: Map<string, number>;
  readonly diagnostics: ContentDiagnostic[];
  readonly references: AuthoredReference[];
  readonly relativePath: string;
  readonly uses: Map<string, number>;
  fence: string | undefined;
};

export function documentReferences(
  relativePath: string,
  frontmatter: ParsedFrontmatter
): readonly AuthoredReference[] {
  const about = asStringList(frontmatter.fields.get('about')?.value) ?? [];
  return [
    ...about.map((raw) => ({
      kind: 'catalog' as const,
      raw,
      source: relativePath,
    })),
    ...markdownReferences(relativePath, frontmatter.bodyLines),
  ];
}

export function markdownReferences(
  relativePath: string,
  lines: readonly string[]
): readonly AuthoredReference[] {
  return parseMarkdownReferences(relativePath, lines).references;
}

export function markdownReferenceDiagnostics(
  relativePath: string,
  lines: readonly string[]
): readonly ContentDiagnostic[] {
  return parseMarkdownReferences(relativePath, lines).diagnostics;
}

export function isCatalogReference(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*:(?:[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/u.test(
    value
  );
}

function parseMarkdownReferences(
  relativePath: string,
  lines: readonly string[]
): MarkdownReferenceResult {
  const state: MarkdownScanState = {
    definitions: new Map(),
    diagnostics: [],
    fence: undefined,
    references: [],
    relativePath,
    uses: new Map(),
  };

  for (const [index, line] of lines.entries()) {
    scanMarkdownLine(state, line, index + 1);
  }
  addFootnoteDiagnostics(state);
  return { diagnostics: state.diagnostics, references: state.references };
}

function scanMarkdownLine(
  state: MarkdownScanState,
  line: string,
  lineNumber: number
): void {
  const fenceMarker = fenceMarkerFor(line);
  if (state.fence === undefined && fenceMarker !== undefined) {
    state.fence = fenceMarker;
    return;
  }
  if (state.fence !== undefined) {
    if (line.trimStart().startsWith(state.fence)) {
      state.fence = undefined;
    }
    return;
  }
  const definition = parseFootnoteDefinition(line);
  if (definition !== undefined) {
    recordFootnoteDefinition(state, definition, lineNumber);
    return;
  }
  recordFootnoteUses(state, line, lineNumber);
  addMarkdownLinkReferences(state.references, state.relativePath, line);
}

function recordFootnoteDefinition(
  state: MarkdownScanState,
  definition: Readonly<{ readonly key: string; readonly target: string }>,
  lineNumber: number
): void {
  if (state.definitions.has(definition.key)) {
    state.diagnostics.push(
      referenceDiagnostic(state.relativePath, {
        line: lineNumber,
        message: `footnote definition is duplicated: ${definition.key}`,
        severity: 'error',
        target: definition.key,
      })
    );
  } else {
    state.definitions.set(definition.key, lineNumber);
  }
  addDefinitionReferences(
    state.references,
    state.relativePath,
    definition.target
  );
}

function recordFootnoteUses(
  state: MarkdownScanState,
  line: string,
  lineNumber: number
): void {
  for (const usage of line.matchAll(/\[\^(?<key>[^\]]+)\]/gu)) {
    const key = usage.groups?.key;
    if (key !== undefined) {
      state.uses.set(key, lineNumber);
    }
  }
}

function addFootnoteDiagnostics(state: MarkdownScanState): void {
  for (const [key, lineNumber] of state.uses) {
    if (state.definitions.has(key)) {
      continue;
    }
    state.diagnostics.push(
      referenceDiagnostic(state.relativePath, {
        line: lineNumber,
        message: `footnote definition is missing: ${key}`,
        severity: 'error',
        target: key,
      })
    );
  }
  for (const [key, lineNumber] of state.definitions) {
    if (state.uses.has(key)) {
      continue;
    }
    state.diagnostics.push(
      referenceDiagnostic(state.relativePath, {
        line: lineNumber,
        message: `footnote definition is unused: ${key}`,
        severity: 'warning',
        target: key,
      })
    );
  }
}

function addMarkdownLinkReferences(
  references: AuthoredReference[],
  relativePath: string,
  line: string
): void {
  for (const match of line.matchAll(
    /(?<!!)(?:\[[^\]]*\])\(\s*(?<target>[^)]+)\)/gu
  )) {
    const raw = destinationFromMarkdownTarget(match.groups?.target);
    if (raw !== undefined) {
      references.push(referenceFor(relativePath, raw));
    }
  }
}

function addDefinitionReferences(
  references: AuthoredReference[],
  relativePath: string,
  target: string
): void {
  const links = [
    ...target.matchAll(/(?<!!)(?:\[[^\]]*\])\(\s*(?<target>[^)]+)\)/gu),
  ];
  if (links.length > 0) {
    for (const link of links) {
      const raw = destinationFromMarkdownTarget(link.groups?.target);
      if (raw !== undefined) {
        references.push(referenceFor(relativePath, raw));
      }
    }
    return;
  }
  const raw = destinationFromMarkdownTarget(target);
  if (raw !== undefined) {
    references.push(referenceFor(relativePath, raw));
  }
}

function destinationFromMarkdownTarget(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const unwrapped =
    trimmed.startsWith('<') && trimmed.includes('>')
      ? trimmed.slice(1, trimmed.indexOf('>'))
      : trimmed;
  const quote = unwrapped.search(/\s+["']/u);
  return quote < 0 ? unwrapped : unwrapped.slice(0, quote);
}

function parseFootnoteDefinition(
  line: string
): Readonly<{ readonly key: string; readonly target: string }> | undefined {
  const match = /^\s*\[\^(?<key>[^\]]+)\]:\s*(?<target>.*)$/u.exec(line);
  const key = match?.groups?.key;
  const target = match?.groups?.target;
  return key === undefined || target === undefined
    ? undefined
    : { key, target };
}

function fenceMarkerFor(line: string): string | undefined {
  const match = /^\s*(?<marker>`{3,}|~{3,})/u.exec(line);
  const marker = match?.groups?.marker?.[0];
  if (marker === '`' || marker === '~') {
    return marker;
  }
  return undefined;
}

type ReferenceDiagnosticOptions = Readonly<{
  readonly line: number;
  readonly message: string;
  readonly severity: ContentDiagnostic['severity'];
  readonly target: string;
}>;

function referenceDiagnostic(
  relativePath: string,
  options: ReferenceDiagnosticOptions
): ContentDiagnostic {
  return makeDiagnostic({
    location: { column: 1, line: options.line },
    message: options.message,
    path: relativePath,
    ruleId: 'FW-REF-003',
    severity: options.severity,
    target: options.target,
  });
}

function referenceFor(relativePath: string, raw: string): AuthoredReference {
  if (isCatalogReference(raw)) {
    return { kind: 'catalog', raw, source: relativePath };
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return { kind: 'external', raw, source: relativePath };
  }
  if (raw.startsWith('#')) {
    return {
      kind: 'internal',
      raw,
      source: relativePath,
      target: `doc:${relativePath}#${normalizeFragment(raw.slice(1))}`,
    };
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(raw)) {
    return { kind: 'external', raw, source: relativePath };
  }
  const [linkedPath, fragment] = raw.split('#', 2);
  const targetPath = path.posix.normalize(
    path.posix.join(path.posix.dirname(relativePath), linkedPath ?? '')
  );
  return {
    kind: 'internal',
    raw,
    source: relativePath,
    target: `doc:${targetPath}${fragment === undefined ? '' : `#${normalizeFragment(fragment)}`}`,
  };
}

function normalizeFragment(value: string): string {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}
