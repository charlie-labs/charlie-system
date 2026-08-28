import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';
import { parseYamlScalar } from './yaml-values.js';
import type { ParsedYaml, YamlField, YamlValue } from './yaml.js';

type SourceLine = Readonly<{
  readonly line: number;
  readonly text: string;
}>;

type ParseContext = Readonly<{
  readonly diagnostics: ContentDiagnostic[];
  readonly path: string;
  readonly ruleId: string;
}>;

type ParsedKeyValue = Readonly<{
  readonly key: string;
  readonly rawValue: string;
}>;

type BlockResult = Readonly<{
  readonly nextIndex: number;
  readonly value?: YamlValue;
}>;

type NestedBlockContext = Readonly<{
  readonly context: ParseContext;
  readonly indentation: number;
  readonly parentIndentation: number;
  readonly sourceLines: readonly SourceLine[];
  readonly startIndex: number;
}>;

export function parseFields(
  relativePath: string,
  sourceLines: readonly SourceLine[],
  ruleId: string
): ParsedYaml {
  const context = {
    diagnostics: [],
    path: relativePath,
    ruleId,
  } satisfies ParseContext;
  const fields = new Map<string, YamlField>();
  let index = 0;
  while (index < sourceLines.length) {
    const source = sourceLines[index];
    if (source === undefined || isBlank(source.text)) {
      index += 1;
      continue;
    }
    if (countIndentation(source.text) !== 0) {
      addError(context, 'YAML entries must start with a top-level key', source);
      index += 1;
      continue;
    }
    const entry = parseKeyValue(source.text.trim());
    if (entry === undefined) {
      addError(context, 'YAML entries must use key: value syntax', source);
      index += 1;
      continue;
    }
    if (fields.has(entry.key)) {
      addError(
        context,
        `YAML field is duplicated: ${entry.key}`,
        source,
        entry.key
      );
      index += 1;
      continue;
    }
    const block =
      entry.rawValue.trim() === ''
        ? parseBlock(context, sourceLines, index + 1, 0)
        : { nextIndex: index + 1, value: parseYamlScalar(entry.rawValue) };
    fields.set(entry.key, {
      line: source.line,
      value: block.value ?? '',
    });
    index = block.nextIndex;
  }
  return { diagnostics: context.diagnostics, fields };
}

function parseBlock(
  context: ParseContext,
  sourceLines: readonly SourceLine[],
  startIndex: number,
  parentIndentation: number
): BlockResult {
  const first = nextContentLine(sourceLines, startIndex);
  if (first === undefined) {
    return { nextIndex: sourceLines.length };
  }
  const firstIndentation = countIndentation(first.line.text);
  if (firstIndentation <= parentIndentation) {
    return { nextIndex: first.index };
  }
  return first.line.text.trimStart().startsWith('-')
    ? parseList({
        context,
        indentation: firstIndentation,
        parentIndentation,
        sourceLines,
        startIndex: first.index,
      })
    : parseMap({
        context,
        indentation: firstIndentation,
        parentIndentation,
        sourceLines,
        startIndex: first.index,
      });
}

function parseMap(input: NestedBlockContext): BlockResult {
  const values = new Map<string, YamlValue>();
  let index = input.startIndex;
  while (index < input.sourceLines.length) {
    const source = input.sourceLines[index];
    if (source === undefined || isBlank(source.text)) {
      index += 1;
      continue;
    }
    const currentIndentation = countIndentation(source.text);
    if (currentIndentation <= input.parentIndentation) {
      break;
    }
    if (currentIndentation !== input.indentation) {
      addError(
        input.context,
        'nested YAML entries must use consistent indentation',
        source
      );
      index += 1;
      continue;
    }
    const entry = parseKeyValue(source.text.trim());
    if (entry === undefined) {
      addError(
        input.context,
        'nested YAML entries must use key: value syntax',
        source
      );
      index += 1;
      continue;
    }
    if (values.has(entry.key)) {
      addError(
        input.context,
        `YAML field is duplicated: ${entry.key}`,
        source,
        entry.key
      );
      index += 1;
      continue;
    }
    const block =
      entry.rawValue.trim() === ''
        ? parseBlock(
            input.context,
            input.sourceLines,
            index + 1,
            input.indentation
          )
        : { nextIndex: index + 1, value: parseYamlScalar(entry.rawValue) };
    values.set(entry.key, block.value ?? '');
    index = block.nextIndex;
  }
  return { nextIndex: index, value: values };
}

function parseList(input: NestedBlockContext): BlockResult {
  const values: YamlValue[] = [];
  let index = input.startIndex;
  while (index < input.sourceLines.length) {
    const source = input.sourceLines[index];
    if (source === undefined || isBlank(source.text)) {
      index += 1;
      continue;
    }
    const currentIndentation = countIndentation(source.text);
    if (currentIndentation <= input.parentIndentation) {
      break;
    }
    if (currentIndentation !== input.indentation) {
      addError(
        input.context,
        'nested YAML entries must use consistent indentation',
        source
      );
      index += 1;
      continue;
    }
    const match = /^-\s*(?<value>.*)$/u.exec(source.text.trim());
    const rawValue = match?.groups?.value;
    if (rawValue === undefined || rawValue.trim() === '') {
      addError(input.context, 'YAML list items must have a value', source);
      index += 1;
      continue;
    }
    values.push(parseYamlScalar(rawValue));
    index += 1;
  }
  return { nextIndex: index, value: values };
}

function parseKeyValue(value: string): ParsedKeyValue | undefined {
  const match = /^(?<key>[A-Za-z][A-Za-z0-9_./-]*):(?:\s*(?<value>.*))?$/u.exec(
    value
  );
  const key = match?.groups?.key;
  return key === undefined
    ? undefined
    : { key, rawValue: match?.groups?.value ?? '' };
}

function nextContentLine(
  sourceLines: readonly SourceLine[],
  startIndex: number
): Readonly<{ readonly index: number; readonly line: SourceLine }> | undefined {
  for (let index = startIndex; index < sourceLines.length; index += 1) {
    const line = sourceLines[index];
    if (line !== undefined && !isBlank(line.text)) {
      return { index, line };
    }
  }
  return undefined;
}

function addError(
  context: ParseContext,
  message: string,
  source: SourceLine,
  field?: string
): void {
  context.diagnostics.push(
    makeDiagnostic({
      ...(field === undefined ? {} : { field }),
      message,
      path: context.path,
      ruleId: context.ruleId,
      source: { column: countIndentation(source.text) + 1, line: source.line },
    })
  );
}

function countIndentation(value: string): number {
  return value.length - value.trimStart().length;
}

function isBlank(value: string): boolean {
  return value.trim() === '' || value.trimStart().startsWith('#');
}
