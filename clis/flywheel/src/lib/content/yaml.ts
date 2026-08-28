import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import { parseFields } from './yaml-parser.js';

export type YamlValue =
  | boolean
  | null
  | number
  | readonly YamlValue[]
  | ReadonlyMap<string, YamlValue>
  | string;

export type YamlField = Readonly<{
  readonly line: number;
  readonly value: YamlValue;
}>;

export type ParsedYaml = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly fields: ReadonlyMap<string, YamlField>;
}>;

export type ParsedFrontmatter = Readonly<{
  readonly bodyLines: readonly string[];
  readonly closingLine: number;
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly fields: ReadonlyMap<string, YamlField>;
}>;

type SourceLine = Readonly<{
  readonly line: number;
  readonly text: string;
}>;

export function parseYaml(
  relativePath: string,
  content: string,
  ruleId = 'FW-YAML-001'
): ParsedYaml {
  const lines: readonly SourceLine[] = content
    .split(/\r?\n/u)
    .map((text, index) => ({
      line: index + 1,
      text,
    }));
  return parseFields(relativePath, lines, ruleId);
}

export function parseFrontmatter(
  relativePath: string,
  content: string,
  ruleId = 'FW-FRONTMATTER-001'
): ParsedFrontmatter | undefined {
  const lines = content.split(/\r?\n/u);
  const diagnostics: ContentDiagnostic[] = [];
  if (lines[0]?.trim() !== '---') {
    diagnostics.push(
      makeDiagnostic({
        message: 'Markdown artifacts require YAML frontmatter',
        path: relativePath,
        ruleId,
        source: { column: 1, line: 1 },
      })
    );
    return {
      bodyLines: [],
      closingLine: -1,
      diagnostics,
      fields: new Map(),
    };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === '---'
  );
  if (closingIndex < 0) {
    diagnostics.push(
      makeDiagnostic({
        message: 'frontmatter must have a closing --- delimiter',
        path: relativePath,
        ruleId,
        source: { column: 1, line: 1 },
      })
    );
    return {
      bodyLines: [],
      closingLine: -1,
      diagnostics,
      fields: new Map(),
    };
  }

  const frontmatterLines: readonly SourceLine[] = lines
    .slice(1, closingIndex)
    .map((text, index) => ({ line: index + 2, text }));
  const parsed = parseFields(relativePath, frontmatterLines, ruleId);
  return {
    bodyLines: lines.slice(closingIndex + 1),
    closingLine: closingIndex + 1,
    diagnostics: parsed.diagnostics,
    fields: parsed.fields,
  };
}

export function asString(value: YamlValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asStringList(
  value: YamlValue | undefined
): readonly string[] | undefined {
  const list = asYamlList(value);
  if (list === undefined) {
    return undefined;
  }
  return list.every((item) => typeof item === 'string') ? list : undefined;
}

export function asYamlList(
  value: YamlValue | undefined
): readonly YamlValue[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

export function asMap(
  value: YamlValue | undefined
): ReadonlyMap<string, YamlValue> | undefined {
  return value instanceof Map ? value : undefined;
}
