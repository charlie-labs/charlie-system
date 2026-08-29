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
import type { ParsedYamlDocument } from '../yaml/contract.js';
import { parseYaml } from '../yaml/parse.js';
import type { CatalogArtifact } from './contract.js';
import {
  catalogEntityRequiredProblem,
  catalogIdentity,
  type CatalogIdentity,
  catalogMapping,
  optionalCatalogString,
  stringMap,
} from './identity.js';
import { catalogLifecycle } from './lifecycle.js';
import { catalogReferences } from './references.js';
import { catalogFields, catalogSpec, type CatalogSpec } from './values.js';

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
      problems.push(catalogEntityRequiredProblem(input));
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
  const identity = catalogIdentity(
    value,
    document.fieldSources,
    document.source,
    problems
  );
  const spec = catalogSpec(value, document.source, problems);
  if (identity === undefined || spec === undefined) return undefined;
  const lifecycle = catalogLifecycle({
    fieldSources: document.fieldSources,
    problems,
    source: document.source,
    spec: spec.source,
  });
  if (lifecycle === undefined) return undefined;
  const description = optionalCatalogString(
    identity.metadata,
    'description',
    document,
    problems
  );
  const title = optionalCatalogString(
    identity.metadata,
    'title',
    document,
    problems
  );
  const authoredReferences = catalogReferences({
    fieldSources: document.fieldSources,
    metadata: identity.metadata,
    problems,
    source: document.source,
    spec: spec.source,
  });
  if (authoredReferences === undefined) return undefined;
  const fields = catalogFields(value, document, problems);
  if (fields === undefined) return undefined;
  return createCatalogArtifact({
    authoredReferences,
    description,
    document,
    fields,
    identity,
    input,
    lifecycle,
    problems,
    spec,
    title,
  });
}

function createCatalogArtifact(
  input: Readonly<{
    readonly authoredReferences: CatalogArtifact['authoredReferences'];
    readonly description: string | undefined;
    readonly document: ParsedYamlDocument;
    readonly fields: CatalogArtifact['fields'];
    readonly identity: CatalogIdentity;
    readonly input: ArtifactParseInput;
    readonly lifecycle: string;
    readonly problems: ArtifactProblem[];
    readonly spec: CatalogSpec;
    readonly title: string | undefined;
  }>
): CatalogArtifact {
  const { document, identity } = input;
  const namespaceSource = document.fieldSources.get('metadata.namespace');
  return {
    annotations: stringMap(
      input.identity.metadata,
      'annotations',
      input.problems,
      document.source
    ),
    apiVersion: input.identity.apiVersion,
    authoredReferences: input.authoredReferences,
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    entityKind: identity.entityKind,
    fields: input.fields,
    kind: 'catalog',
    labels: stringMap(
      input.identity.metadata,
      'labels',
      input.problems,
      document.source
    ),
    lifecycle: {
      active:
        input.lifecycle !== 'deprecated' && input.lifecycle !== 'superseded',
      status: input.lifecycle,
    },
    name: identity.name,
    namespace: identity.namespace,
    ...(namespaceSource === undefined ? {} : { namespaceSource }),
    path: input.input.entry.path,
    region: input.input.entry.region,
    source: document.source,
    spec: input.spec.normalized,
    target: catalogTarget(identity),
    ...(input.title === undefined ? {} : { title: input.title }),
  };
}
