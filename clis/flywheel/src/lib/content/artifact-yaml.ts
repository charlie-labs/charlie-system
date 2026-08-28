import path from 'node:path';

import {
  catalogReviewEvery,
  validateCatalogRequirements,
  validatePathIdentity,
  validateRoleFieldNames,
  validateRoleRequirements,
} from './artifact-requirements.js';
import type {
  ArtifactScope,
  ParsedArtifact,
  ParsedFile,
} from './artifact-types.js';
import { catalogReferences } from './artifact-yaml-references.js';
import type { ClassifiedFile } from './files.js';
import { asMap, asString, parseYaml } from './yaml.js';

export function parseRole(
  classified: ClassifiedFile,
  content: string
): ParsedFile {
  const parsed = parseYaml(classified.path, content, 'FW-ROLE-001');
  const diagnostics = [...parsed.diagnostics];
  const id = asString(parsed.fields.get('id')?.value);
  const objective = asString(parsed.fields.get('objective')?.value);
  const schemaVersion =
    parsed.fields.get('schemaVersion') ?? parsed.fields.get('version');
  validateRoleRequirements({
    diagnostics,
    id,
    objective,
    path: classified.path,
    schemaVersion: schemaVersion?.value,
  });
  validateRoleFieldNames(diagnostics, classified.path, parsed.fields.keys());
  const expectedId = path.basename(
    classified.path,
    path.extname(classified.path)
  );
  validatePathIdentity({
    diagnostics,
    expectedId,
    id,
    kind: 'Role',
    path: classified.path,
  });
  return {
    artifact: {
      artifactPath: classified.path,
      category: 'role',
      ...(id === undefined ? {} : { id }),
      references: [],
      region: 'roles',
      target: `role:${id ?? expectedId}`,
    },
    classified,
    content,
    diagnostics,
  };
}

export function parseCatalog(
  classified: ClassifiedFile,
  content: string
): ParsedFile {
  const parsed = parseYaml(classified.path, content, 'FW-CATALOG-001');
  const diagnostics = [...parsed.diagnostics];
  const identity = catalogIdentity(parsed.fields);
  validateCatalogRequirements({
    diagnostics,
    kind: identity.kind,
    name: identity.name,
    path: classified.path,
    reviewEvery: catalogReviewEvery(parsed.fields),
  });
  return {
    artifact: catalogArtifact({
      classified,
      identity,
      references: catalogReferences(classified.path, parsed.fields.values()),
    }),
    classified,
    content,
    diagnostics,
  };
}

function catalogName(
  fields: ReadonlyMap<string, { readonly value: import('./yaml.js').YamlValue }>
): string | undefined {
  const metadata = asMap(fields.get('metadata')?.value);
  const metadataName = asString(metadata?.get('name'));
  return metadataName ?? asString(fields.get('name')?.value);
}

function catalogNamespace(
  fields: ReadonlyMap<string, { readonly value: import('./yaml.js').YamlValue }>
): string {
  const metadata = asMap(fields.get('metadata')?.value);
  return asString(metadata?.get('namespace')) ?? 'default';
}

type CatalogIdentity = Readonly<{
  readonly id?: string;
  readonly kind: string | undefined;
  readonly name: string | undefined;
  readonly target: string;
}>;

function catalogIdentity(
  fields: ReadonlyMap<string, { readonly value: import('./yaml.js').YamlValue }>
): CatalogIdentity {
  const kind = asString(fields.get('kind')?.value);
  const name = catalogName(fields);
  const namespace = catalogNamespace(fields);
  const namePart = name ?? 'unknown';
  return {
    ...(kind === undefined ? {} : { id: `${kind}:${namespace}/${namePart}` }),
    kind,
    name,
    target: `catalog:${kind ?? 'unknown'}:${namespace}/${namePart}`,
  };
}

function catalogArtifact(
  input: Readonly<{
    readonly classified: ClassifiedFile;
    readonly identity: CatalogIdentity;
    readonly references: ReturnType<typeof catalogReferences>;
  }>
): ParsedArtifact {
  return {
    artifactPath: input.classified.path,
    category: 'catalog',
    ...optionalField('id', input.identity.id),
    references: input.references,
    region: requireRegion(input.classified),
    ...optionalField('repositoryId', input.classified.repositoryId),
    target: input.identity.target,
  };
}

function optionalField(
  name: string,
  value: string | undefined
): Readonly<Record<string, string>> {
  if (value === undefined) {
    return {};
  }
  return { [name]: value };
}

function requireRegion(classified: ClassifiedFile): ArtifactScope {
  if (classified.region === undefined) {
    throw new Error(`classified artifact has no region: ${classified.path}`);
  }
  return classified.region;
}
