import {
  isMap,
  isNode,
  isScalar,
  parseAllDocuments,
  type Pair,
  type Range,
} from 'yaml';

import {
  createSourceLocator,
  type SourceLocation,
} from '../../repository/location.js';
import type { ParsedYaml, YamlProblem } from './contract.js';

type FieldSourceContext = Readonly<{
  readonly locator: ReturnType<typeof createSourceLocator>;
  readonly offset: number;
  readonly sources: Map<string, SourceLocation>;
}>;

export function parseYaml(
  contents: string,
  path: string,
  offset = 0,
  sourceContents = contents
): ParsedYaml {
  const locator = createSourceLocator(path, sourceContents);
  const parsed = parseAllDocuments(contents, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  const problems: YamlProblem[] = [];
  const documents = parsed.flatMap((document) => {
    problems.push(
      ...document.errors.map((error) => ({
        message: error.message,
        source: locator.atOffsets(offset + error.pos[0], offset + error.pos[1]),
      }))
    );
    if (document.errors.length > 0) {
      return [];
    }
    const start = document.range[0];
    const end = document.range[2];
    const value: unknown = document.toJS();
    return [
      {
        fieldSources: collectFieldSources(document.contents, locator, offset),
        source: locator.atOffsets(offset + start, offset + end),
        value,
      },
    ];
  });
  return { documents, problems };
}

function collectFieldSources(
  node: unknown,
  locator: ReturnType<typeof createSourceLocator>,
  offset: number,
  prefix: readonly string[] = []
): ReadonlyMap<string, SourceLocation> {
  const sources = new Map<string, SourceLocation>();
  addFieldSources(node, prefix, { locator, offset, sources });
  return sources;
}

function addFieldSources(
  node: unknown,
  prefix: readonly string[],
  context: FieldSourceContext
): void {
  if (!isMap(node)) return;
  for (const pair of node.items) {
    addFieldSource(pair, prefix, context);
  }
}

function addFieldSource(
  pair: Pair,
  prefix: readonly string[],
  context: FieldSourceContext
): void {
  const field = scalarString(pair.key);
  if (field === undefined) return;
  const fieldPath = [...prefix, field];
  const source = pairSource(pair, context);
  if (source !== undefined) context.sources.set(fieldPath.join('.'), source);
  addFieldSources(pair.value, fieldPath, context);
}

function scalarString(value: unknown): string | undefined {
  return isScalar(value) && typeof value.value === 'string'
    ? value.value
    : undefined;
}

function pairSource(
  pair: Pair,
  context: FieldSourceContext
): SourceLocation | undefined {
  const keyRange = nodeRange(pair.key);
  if (keyRange === undefined) return undefined;
  const valueRange = nodeRange(pair.value);
  const end = valueRange === undefined ? keyRange[2] : valueRange[2];
  return context.locator.atOffsets(
    context.offset + keyRange[0],
    context.offset + end
  );
}

function nodeRange(value: unknown): Range | undefined {
  if (!isNode(value)) return undefined;
  return value.range ?? undefined;
}
