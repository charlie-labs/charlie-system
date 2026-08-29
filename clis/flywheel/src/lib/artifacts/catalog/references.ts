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
      catalogFieldReferences(
        input.spec,
        field,
        relationship,
        input.fieldSources.get(`spec.${field}`) ?? input.source
      )
  );
  constructions.push(
    ...catalogLinks(
      input.metadata,
      input.fieldSources.get('metadata.links') ?? input.source
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
  spec: Readonly<Record<string, unknown>>,
  field: string,
  relationship: RelationshipKind,
  source: SourceLocation
): readonly ReturnType<typeof constructAuthoredReference>[] {
  const values = referenceStrings(spec[field]);
  const validValues = stringListField(spec, field);
  return values.flatMap((raw) => {
    const construction = constructAuthoredReference({
      raw,
      relationship,
      source,
    });
    return construction.kind === 'rejected' || validValues !== undefined
      ? [construction]
      : [];
  });
}

function catalogLinks(
  metadata: Readonly<Record<string, unknown>>,
  source: SourceLocation
): readonly ReturnType<typeof constructAuthoredReference>[] {
  return Array.isArray(metadata.links)
    ? metadata.links.flatMap((item) => {
        const link = asRecord(item);
        const raw = link === undefined ? undefined : stringField(link, 'url');
        const label =
          link === undefined ? undefined : stringField(link, 'title');
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
      })
    : [];
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
