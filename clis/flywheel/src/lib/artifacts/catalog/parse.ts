import {
  wholeFileLocation,
  type SourceLocation,
} from '../../repository/location.js';
import { catalogTarget } from '../../targets/id.js';
import type {
  ArtifactCompilation,
  ArtifactParseInput,
  ArtifactProblem,
} from '../contract.js';
import {
  artifactKindMismatch,
  decodeArtifactInput,
  isArtifactCompilation,
  parsedArtifact,
  unparsedArtifact,
} from '../parser.js';
import { asRecord, stringField, stringRecordField } from '../values.js';
import type { ParsedYamlDocument } from '../yaml/contract.js';
import { parseYaml } from '../yaml/parse.js';
import type { CatalogArtifact, CatalogValue } from './contract.js';
import { catalogLifecycle } from './lifecycle.js';
import { catalogReferences } from './references.js';

type CatalogIdentity = Readonly<{
  readonly apiVersion: string;
  readonly entityKind: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly namespace: string;
}>;

type CatalogSpec = Readonly<{
  readonly normalized: Readonly<Record<string, CatalogValue>>;
  readonly source: Readonly<Record<string, unknown>>;
}>;

export function parseCatalogArtifact(
  input: ArtifactParseInput
): ArtifactCompilation {
  const mismatch = artifactKindMismatch(input, 'catalog');
  if (mismatch !== undefined) return mismatch;
  const decoded = decodeArtifactInput(input);
  if (isArtifactCompilation(decoded)) return decoded;
  const yaml = parseYaml(decoded.contents, input.entry.path);
  const problems: ArtifactProblem[] = yaml.problems.map((item) => ({
    code: 'CATALOG_YAML_INVALID',
    message: `invalid Catalog YAML: ${item.message}`,
    source: item.source,
  }));
  const artifacts = yaml.documents.flatMap((document, index) => {
    const artifact = catalogArtifact(input, document, problems, index);
    return artifact === undefined ? [] : [artifact];
  });
  if (artifacts.length === 0) {
    if (yaml.documents.length === 0 && problems.length === 0) {
      problems.push(
        problem(
          input,
          'CATALOG_ENTITY_REQUIRED',
          'Catalog file contains no entity'
        )
      );
    }
    return unparsedArtifact(input, problems);
  }
  return parsedArtifact(input, artifacts, problems);
}

function catalogArtifact(
  input: ArtifactParseInput,
  document: ParsedYamlDocument,
  problems: ArtifactProblem[],
  index: number
): CatalogArtifact | undefined {
  const value = catalogMapping(document, index, problems);
  if (value === undefined) return undefined;
  const identity = catalogIdentity(value, document.source, problems);
  const spec = catalogSpec(value, document.source, problems);
  if (identity === undefined || spec === undefined) return undefined;
  const lifecycle = catalogLifecycle({
    fieldSources: document.fieldSources,
    problems,
    source: document.source,
    spec: spec.source,
  });
  if (lifecycle === undefined) return undefined;
  const description = stringField(identity.metadata, 'description');
  const title = stringField(identity.metadata, 'title');
  const namespaceSource = document.fieldSources.get('metadata.namespace');
  const authoredReferences = catalogReferences({
    fieldSources: document.fieldSources,
    metadata: identity.metadata,
    problems,
    source: document.source,
    spec: spec.source,
  });
  if (authoredReferences === undefined) return undefined;
  return {
    annotations: stringMap(
      identity.metadata,
      'annotations',
      problems,
      document.source
    ),
    apiVersion: identity.apiVersion,
    authoredReferences,
    ...(description === undefined ? {} : { description }),
    entityKind: identity.entityKind,
    kind: 'catalog',
    labels: stringMap(identity.metadata, 'labels', problems, document.source),
    lifecycle: {
      active: lifecycle !== 'deprecated' && lifecycle !== 'superseded',
      status: lifecycle,
    },
    name: identity.name,
    namespace: identity.namespace,
    ...(namespaceSource === undefined ? {} : { namespaceSource }),
    path: input.entry.path,
    region: input.entry.region,
    source: document.source,
    spec: spec.normalized,
    target: catalogTarget(identity),
    ...(title === undefined ? {} : { title }),
  };
}

function catalogMapping(
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
    return undefined;
  }
  return value;
}

function catalogIdentity(
  value: Readonly<Record<string, unknown>>,
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
  if (
    apiVersion === undefined ||
    entityKind === undefined ||
    metadata === undefined ||
    name === undefined
  )
    return undefined;
  return {
    apiVersion,
    entityKind,
    metadata,
    name,
    namespace: stringField(metadata, 'namespace') ?? 'default',
  };
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

function catalogSpec(
  value: Readonly<Record<string, unknown>>,
  source: SourceLocation,
  problems: ArtifactProblem[]
): CatalogSpec | undefined {
  const spec = value.spec === undefined ? {} : asRecord(value.spec);
  if (spec === undefined) {
    problems.push(
      catalogProblem(source, 'SPEC_INVALID', 'Catalog spec must be a mapping')
    );
    return undefined;
  }
  const normalized = catalogRecord(spec);
  if (normalized === undefined) {
    problems.push(
      catalogProblem(
        source,
        'SPEC_INVALID',
        'Catalog spec must contain JSON-compatible values'
      )
    );
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

function stringMap(
  value: Readonly<Record<string, unknown>>,
  field: string,
  problems: ArtifactProblem[],
  source: SourceLocation
): Readonly<Record<string, string>> {
  const record = stringRecordField(value, field);
  if (record === undefined && field in value)
    problems.push({
      code: 'CATALOG_METADATA_INVALID',
      message: `Catalog metadata.${field} values must be strings`,
      source,
    });
  return record ?? {};
}

function problem(
  input: ArtifactParseInput,
  code: string,
  message: string
): ArtifactProblem {
  return { code, message, source: wholeFileLocation(input.entry.path, '') };
}

function catalogProblem(
  source: SourceLocation,
  suffix: string,
  message: string
): ArtifactProblem {
  return { code: `CATALOG_${suffix}`, message, source };
}
