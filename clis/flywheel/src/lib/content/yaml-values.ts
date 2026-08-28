import type { YamlValue } from './yaml.js';

export function parseYamlScalar(rawValue: string): YamlValue {
  const value = stripComment(rawValue.trim());
  const primitive = parsePrimitive(value);
  if (primitive !== undefined) {
    return primitive;
  }
  const list = parseInlineList(value);
  if (list !== undefined) {
    return list;
  }
  const map = parseInlineMap(value);
  return map ?? unquote(value);
}

function parsePrimitive(value: string): YamlValue | undefined {
  if (value === '') return '';
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return /^-?(?:0|[1-9][0-9]*)$/u.test(value) ? Number(value) : undefined;
}

function parseInlineList(value: string): readonly YamlValue[] | undefined {
  if (!(value.startsWith('[') && value.endsWith(']'))) {
    return undefined;
  }
  return splitInline(value.slice(1, -1)).map((item) => parseYamlScalar(item));
}

function parseInlineMap(
  value: string
): ReadonlyMap<string, YamlValue> | undefined {
  if (!(value.startsWith('{') && value.endsWith('}'))) {
    return undefined;
  }
  const map = new Map<string, YamlValue>();
  for (const item of splitInline(value.slice(1, -1))) {
    const separator = findUnquoted(item, ':');
    if (separator < 0) {
      continue;
    }
    const key = unquote(item.slice(0, separator).trim());
    if (key !== '') {
      map.set(key, parseYamlScalar(item.slice(separator + 1)));
    }
  }
  return map;
}

function splitInline(value: string): readonly string[] {
  const items: string[] = [];
  let start = 0;
  const state: InlineState = { depth: 0, quote: undefined };
  for (let index = 0; index < value.length; index += 1) {
    if (!consumeInlineCharacter(value, index, state)) {
      continue;
    }
    items.push(value.slice(start, index).trim());
    start = index + 1;
  }
  const final = value.slice(start).trim();
  return final === '' ? items : [...items, final];
}

type InlineState = {
  depth: number;
  quote: string | undefined;
};

function consumeInlineCharacter(
  value: string,
  index: number,
  state: InlineState
): boolean {
  const character = value[index];
  if (state.quote !== undefined) {
    consumeQuotedCharacter(character, value[index - 1], state);
    return false;
  }
  if (isQuote(character)) {
    state.quote = character;
    return false;
  }
  if (isOpeningDelimiter(character)) {
    state.depth += 1;
    return false;
  }
  if (isClosingDelimiter(character)) {
    state.depth -= 1;
    return false;
  }
  return character === ',' && state.depth === 0;
}

function consumeQuotedCharacter(
  character: string | undefined,
  previous: string | undefined,
  state: InlineState
): void {
  if (character === state.quote && previous !== '\\') {
    state.quote = undefined;
  }
}

function isQuote(value: string | undefined): value is '"' | "'" {
  return value === '"' || value === "'";
}

function isOpeningDelimiter(value: string | undefined): boolean {
  return value === '[' || value === '{';
}

function isClosingDelimiter(value: string | undefined): boolean {
  return value === ']' || value === '}';
}

function findUnquoted(value: string, expected: string): number {
  let quote: string | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote !== undefined) {
      if (character === quote && value[index - 1] !== '\\') {
        quote = undefined;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === expected) {
      return index;
    }
  }
  return -1;
}

function stripComment(value: string): string {
  let offset = 0;
  while (offset < value.length) {
    const relativeIndex = findUnquoted(value.slice(offset), '#');
    if (relativeIndex < 0) {
      return value;
    }
    const index = offset + relativeIndex;
    if (index === 0 || /\s/u.test(value[index - 1] ?? '')) {
      return value.slice(0, index).trimEnd();
    }
    offset = index + 1;
  }
  return value;
}

function unquote(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return quoted ? value.slice(1, -1) : value;
}
