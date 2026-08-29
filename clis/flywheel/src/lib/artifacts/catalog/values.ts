import type { SourceLocation } from '../../repository/location.js';
import type { ArtifactProblem } from '../contract.js';
import { asRecord } from '../values.js';
import type { ParsedYamlDocument } from '../yaml/contract.js';
import type { CatalogArtifact, CatalogValue } from './contract.js';

export type CatalogSpec = Readonly<{
  readonly normalized: Readonly<Record<string, CatalogValue>>;
  readonly source: Readonly<Record<string, unknown>>;
}>;

export function catalogSpec(
  value: Readonly<Record<string, unknown>>,
  source: SourceLocation,
  problems: ArtifactProblem[]
): CatalogSpec | undefined {
  const spec = value.spec === undefined ? {} : asRecord(value.spec);
  if (spec === undefined) {
    problems.push({
      code: 'CATALOG_SPEC_INVALID',
      message: 'Catalog spec must be a mapping',
      source,
    });
    return undefined;
  }
  const normalized = catalogRecord(spec);
  if (normalized === undefined) {
    problems.push({
      code: 'CATALOG_SPEC_INVALID',
      message: 'Catalog spec must contain JSON-compatible values',
      source,
    });
    return undefined;
  }
  return { normalized, source: spec };
}

function catalogRecord(
  value: Readonly<Record<string, unknown>>
): Readonly<Record<string, CatalogValue>> | undefined {
  const result: Record<string, CatalogValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const converted = catalogValue(item);
    if (converted === undefined) return undefined;
    result[key] = converted;
  }
  return result;
}

export function catalogFields(
  value: Readonly<Record<string, unknown>>,
  document: ParsedYamlDocument,
  problems: ArtifactProblem[]
): CatalogArtifact['fields'] | undefined {
  const fields: Array<CatalogArtifact['fields'][number]> = [];
  for (const field of expandedFields(value)) {
    const converted = catalogValue(field.value);
    if (converted === undefined) {
      problems.push({
        code: 'CATALOG_FIELD_INVALID',
        message: `Catalog ${field.name} must contain JSON-compatible values`,
        source: document.fieldSources.get(field.name) ?? document.source,
      });
      return undefined;
    }
    fields.push({
      name: field.name,
      source: document.fieldSources.get(field.name) ?? document.source,
      value: converted,
    });
  }
  return fields;
}

function expandedFields(
  value: Readonly<Record<string, unknown>>
): readonly Readonly<{ readonly name: string; readonly value: unknown }>[] {
  return Object.entries(value).flatMap(([name, fieldValue]) => {
    const record =
      name === 'metadata' || name === 'spec' ? asRecord(fieldValue) : undefined;
    return record === undefined
      ? [{ name, value: fieldValue }]
      : Object.entries(record).map(([child, childValue]) => ({
          name: `${name}.${child}`,
          value: childValue,
        }));
  });
}

function catalogValue(value: unknown): CatalogValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const converted = value.map((item) => catalogValue(item));
    return converted.some((item) => item === undefined)
      ? undefined
      : converted.flatMap((item) => (item === undefined ? [] : [item]));
  }
  const record = asRecord(value);
  return record === undefined ? undefined : catalogRecord(record);
}
