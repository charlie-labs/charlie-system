import {
  wholeFileLocation,
  type SourceLocation,
} from '../../repository/location.js';
import type { ArtifactParseInput, ArtifactProblem } from '../contract.js';
import { asRecord, stringField, stringRecordField } from '../values.js';
import type { ParsedYamlDocument } from '../yaml/contract.js';

export type CatalogIdentity = Readonly<{
  readonly apiVersion: string;
  readonly entityKind: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly namespace: string;
}>;

export function catalogMapping(
  document: ParsedYamlDocument,
  index: number,
  problems: ArtifactProblem[]
): Readonly<Record<string, unknown>> | undefined {
  const value = asRecord(document.value);
  if (value === undefined) {
    problems.push(
      catalogProblem(
        document.source,
        'MAPPING_REQUIRED',
        `Catalog document ${index + 1} must be a mapping`
      )
    );
  }
  return value;
}

export function catalogIdentity(
  value: Readonly<Record<string, unknown>>,
  fieldSources: ReadonlyMap<string, SourceLocation>,
  source: SourceLocation,
  problems: ArtifactProblem[]
): CatalogIdentity | undefined {
  const apiVersion = stringField(value, 'apiVersion');
  const entityKind = stringField(value, 'kind');
  const metadata = asRecord(value.metadata);
  const name =
    metadata === undefined ? undefined : stringField(metadata, 'name');
  addRequiredProblem('apiVersion', apiVersion, source, problems);
  addRequiredProblem('kind', entityKind, source, problems);
  addRequiredProblem('metadata.name', name, source, problems);
  if (apiVersion === undefined) return undefined;
  if (entityKind === undefined) return undefined;
  if (metadata === undefined || name === undefined) return undefined;
  const namespace = catalogNamespace(metadata, fieldSources, source, problems);
  if (namespace === undefined) return undefined;
  return { apiVersion, entityKind, metadata, name, namespace };
}

export function optionalCatalogString(
  metadata: Readonly<Record<string, unknown>>,
  field: 'description' | 'title',
  document: ParsedYamlDocument,
  problems: ArtifactProblem[]
): string | undefined {
  const value = stringField(metadata, field);
  if (field in metadata && value === undefined) {
    problems.push(
      catalogProblem(
        document.fieldSources.get(`metadata.${field}`) ?? document.source,
        'METADATA_INVALID',
        `Catalog metadata.${field} must be a non-empty string`
      )
    );
  }
  return value;
}

export function stringMap(
  value: Readonly<Record<string, unknown>>,
  field: string,
  problems: ArtifactProblem[],
  source: SourceLocation
): Readonly<Record<string, string>> {
  const record = stringRecordField(value, field);
  if (record === undefined && field in value) {
    problems.push({
      code: 'CATALOG_METADATA_INVALID',
      message: `Catalog metadata.${field} values must be strings`,
      source,
    });
  }
  return record ?? {};
}

export function catalogEntityRequiredProblem(
  input: ArtifactParseInput
): ArtifactProblem {
  return {
    code: 'CATALOG_ENTITY_REQUIRED',
    message: 'Catalog file contains no entity',
    source: wholeFileLocation(input.entry.path, ''),
  };
}

function catalogNamespace(
  metadata: Readonly<Record<string, unknown>>,
  fieldSources: ReadonlyMap<string, SourceLocation>,
  source: SourceLocation,
  problems: ArtifactProblem[]
): string | undefined {
  if (!('namespace' in metadata)) return 'default';
  const namespace = stringField(metadata, 'namespace');
  if (namespace !== undefined) return namespace;
  problems.push(
    catalogProblem(
      fieldSources.get('metadata.namespace') ?? source,
      'METADATA_INVALID',
      'Catalog metadata.namespace must be a non-empty string'
    )
  );
  return undefined;
}

function addRequiredProblem(
  fieldName: string,
  value: string | undefined,
  source: SourceLocation,
  problems: ArtifactProblem[]
): void {
  if (value === undefined) {
    problems.push(
      catalogProblem(
        source,
        'FIELD_REQUIRED',
        `Catalog entity requires ${fieldName}`
      )
    );
  }
}

function catalogProblem(
  source: SourceLocation,
  suffix: string,
  message: string
): ArtifactProblem {
  return { code: `CATALOG_${suffix}`, message, source };
}
