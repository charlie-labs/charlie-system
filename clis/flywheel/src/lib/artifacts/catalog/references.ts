import type {
  AuthoredReference,
  RelationshipKind,
} from '../../references/contract.js';
import type { SourceLocation } from '../../repository/location.js';
import { constructAuthoredReference } from '../authored-reference.js';
import type { ArtifactProblem } from '../contract.js';
import { asRecord, stringField, stringListField } from '../values.js';

const REFERENCE_FIELDS: Readonly<Record<string, RelationshipKind>> = {
  consumesApis: 'consumes-api',
  dependsOn: 'depends-on',
  domain: 'part-of',
  memberOf: 'member-of',
  owner: 'owned-by',
  parent: 'part-of',
  providesApis: 'provides-api',
  subcomponentOf: 'part-of',
  system: 'part-of',
};

export function catalogReferences(input: {
  readonly fieldSources: ReadonlyMap<string, SourceLocation>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly problems: ArtifactProblem[];
  readonly source: SourceLocation;
  readonly spec: Readonly<Record<string, unknown>>;
}): readonly AuthoredReference[] | undefined {
  const constructions = Object.entries(REFERENCE_FIELDS).flatMap(
    ([field, relationship]) =>
      catalogFieldReferences({
        field,
        problems: input.problems,
        relationship,
        source: input.fieldSources.get(`spec.${field}`) ?? input.source,
        spec: input.spec,
      })
  );
  constructions.push(
    ...catalogLinks(
      input.metadata,
      input.fieldSources.get('metadata.links') ?? input.source,
      input.problems
    )
  );
  const rejected = constructions.filter(
    (construction) => construction.kind === 'rejected'
  );
  input.problems.push(...rejected.map((construction) => construction.problem));
  if (rejected.length > 0) return undefined;
  return constructions.flatMap((construction) =>
    construction.kind === 'accepted' ? [construction.reference] : []
  );
}

function catalogFieldReferences(
  input: Readonly<{
    readonly field: string;
    readonly problems: ArtifactProblem[];
    readonly relationship: RelationshipKind;
    readonly source: SourceLocation;
    readonly spec: Readonly<Record<string, unknown>>;
  }>
): readonly ReturnType<typeof constructAuthoredReference>[] {
  const values = referenceStrings(input.spec[input.field]);
  const validValues = stringListField(input.spec, input.field);
  if (
    input.field in input.spec &&
    (validValues === undefined ||
      (typeof input.spec[input.field] === 'string' && values.length === 0))
  ) {
    input.problems.push({
      code: 'CATALOG_REFERENCE_INVALID',
      message: `Catalog spec.${input.field} must be a non-empty string or list of non-empty strings`,
      source: input.source,
    });
  }
  return values.map((raw) =>
    constructAuthoredReference({
      raw,
      relationship: input.relationship,
      source: input.source,
    })
  );
}

function catalogLinks(
  metadata: Readonly<Record<string, unknown>>,
  source: SourceLocation,
  problems: ArtifactProblem[]
): readonly ReturnType<typeof constructAuthoredReference>[] {
  if (!('links' in metadata)) return [];
  if (!Array.isArray(metadata.links)) {
    problems.push(invalidLinksProblem(source));
    return [];
  }
  return metadata.links.flatMap((item) => {
    const link = asRecord(item);
    const raw = link === undefined ? undefined : stringField(link, 'url');
    const label = link === undefined ? undefined : stringField(link, 'title');
    if (
      link === undefined ||
      raw === undefined ||
      ('title' in link && label === undefined)
    ) {
      problems.push(invalidLinksProblem(source));
    }
    return raw === undefined
      ? []
      : [
          constructAuthoredReference({
            ...(label === undefined ? {} : { label }),
            raw,
            relationship: 'links-to',
            source,
          }),
        ];
  });
}

function invalidLinksProblem(source: SourceLocation): ArtifactProblem {
  return {
    code: 'CATALOG_REFERENCE_INVALID',
    message:
      'Catalog metadata.links must be a list of mappings with non-empty url and optional title strings',
    source,
  };
}

function referenceStrings(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value.trim()];
  }
  return Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === 'string' && item.trim() !== '' ? [item.trim()] : []
      )
    : [];
}
