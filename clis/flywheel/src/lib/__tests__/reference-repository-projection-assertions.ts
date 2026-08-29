import { expect } from 'bun:test';

import type { FlywheelArtifact } from '../artifacts/contract.js';
import type { GraphRelationship } from '../graph/contract.js';
import type {
  AuthoredReference,
  ReferenceResolution,
} from '../references/contract.js';
import type { RepositoryEntry } from '../repository/contract.js';
import { targetId } from '../targets/id.js';
import type { ReferenceRepositoryManifest } from './fixtures/reference-repository-types.js';

export { expectSourceUnits } from './reference-repository-source-assertions.js';

function artifactAt(
  artifacts: readonly FlywheelArtifact[],
  path: string
): FlywheelArtifact {
  const artifact = artifacts.find((candidate) => candidate.path === path);
  if (artifact === undefined)
    throw new Error(`fixture artifact is missing: ${path}`);
  return artifact;
}

export function expectParsedArtifacts(
  artifacts: readonly FlywheelArtifact[],
  expectations: ReferenceRepositoryManifest['parsedArtifacts']
): void {
  const actual = sortStrings(
    artifacts.map((artifact) =>
      JSON.stringify({
        kind: artifact.kind,
        path: artifact.path,
        source: {
          column: artifact.source.start.column,
          line: artifact.source.start.line,
          path: artifact.source.path,
        },
        targetId: targetId(artifact.target),
      })
    )
  );
  const expected = sortStrings(
    expectations.map((expectation) =>
      JSON.stringify({
        kind: expectation.kind,
        path: expectation.path,
        source: {
          column: expectation.source.column,
          line: expectation.source.line,
          path: expectation.source.path,
        },
        targetId: expectation.targetId,
      })
    )
  );
  expect(artifacts).toHaveLength(expectations.length);
  expect(new Set(actual).size).toBe(actual.length);
  expect(actual).toEqual(expected);
}

export function expectAuthoredReferences(
  artifacts: readonly FlywheelArtifact[],
  expectations: ReferenceRepositoryManifest['authoredReferences']
): void {
  const references = artifacts.flatMap(
    (artifact) => artifact.authoredReferences
  );
  const actual = sortStrings(
    references.map((reference) => canonicalAuthoredReference(reference))
  );
  const expected = sortStrings(
    expectations.map((expectation) => canonicalAuthoredExpectation(expectation))
  );
  expect(references).toHaveLength(expectations.length);
  expect(new Set(actual).size).toBe(actual.length);
  expect(actual).toEqual(expected);
}

export function expectCanonicalResolutions(
  resolutions: readonly ReferenceResolution[],
  expectations: ReferenceRepositoryManifest['resolvedReferences']
): void {
  const actual = sortStrings(
    resolutions.map((resolution) => {
      if (resolution.kind !== 'resolved') {
        return JSON.stringify({
          authored: canonicalAuthoredReference(resolution.authored),
          candidates:
            resolution.candidates === undefined
              ? undefined
              : sortStrings(
                  resolution.candidates.map((candidate) => targetId(candidate))
                ),
          kind: resolution.kind,
          reason: resolution.reason,
          sourceTarget: targetId(resolution.sourceTarget),
        });
      }
      return JSON.stringify({
        authored: canonicalAuthoredReference(resolution.authored),
        kind: resolution.kind,
        sourceTarget: targetId(resolution.sourceTarget),
        target: targetId(resolution.target),
      });
    })
  );
  const expected = sortStrings(
    expectations.map((expectation) =>
      JSON.stringify({
        authored: canonicalAuthoredExpectation(expectation.authored),
        kind: 'resolved',
        sourceTarget: expectation.sourceTarget,
        target: expectation.target,
      })
    )
  );
  expect(new Set(actual).size).toBe(actual.length);
  expect(actual).toEqual(expected);
}

export function expectCanonicalRelationships(
  relationships: readonly GraphRelationship[],
  expectations: ReferenceRepositoryManifest['relationships']
): void {
  const actual = sortStrings(
    relationships.map((relationship) => canonicalRelationship(relationship))
  );
  const expected = sortStrings(
    expectations.map((expectation) =>
      JSON.stringify({
        from: expectation.from,
        kind: expectation.kind,
        provenance:
          expectation.provenance.kind === 'authored'
            ? {
                kind: 'authored',
                reference: canonicalAuthoredExpectation(
                  requireValue(expectation.provenance.reference)
                ),
              }
            : {
                kind: 'structural',
                rule: requireValue(expectation.provenance.rule),
                source: canonicalSourceStart(
                  requireValue(expectation.provenance.source)
                ),
              },
        to: expectation.to,
      })
    )
  );
  expect(new Set(actual).size).toBe(actual.length);
  expect(actual).toEqual(expected);
}

function canonicalAuthoredReference(reference: AuthoredReference): string {
  return JSON.stringify({
    ...(reference.citationKey === undefined
      ? {}
      : { citationKey: reference.citationKey }),
    ...(reference.label === undefined ? {} : { label: reference.label }),
    ...(reference.origin === undefined ? {} : { origin: reference.origin }),
    raw: reference.raw,
    relationship: reference.relationship,
    source: {
      column: reference.source.start.column,
      line: reference.source.start.line,
      path: reference.source.path,
    },
  });
}

function canonicalAuthoredExpectation(
  expectation: ReferenceRepositoryManifest['authoredReferences'][number]
): string {
  return JSON.stringify({
    ...(expectation.citationKey === undefined
      ? {}
      : { citationKey: expectation.citationKey }),
    ...(expectation.label === undefined ? {} : { label: expectation.label }),
    ...(expectation.origin === undefined ? {} : { origin: expectation.origin }),
    raw: expectation.raw,
    relationship: expectation.relationship,
    source: {
      column: expectation.source.column,
      line: expectation.source.line,
      path: expectation.source.path,
    },
  });
}

function canonicalRelationship(relationship: GraphRelationship): string {
  const provenance = relationship.provenance;
  return JSON.stringify({
    from: relationship.from,
    kind: relationship.kind,
    provenance:
      provenance.kind === 'authored'
        ? {
            kind: 'authored',
            reference: canonicalAuthoredReference(provenance.reference),
          }
        : {
            kind: 'structural',
            rule: provenance.rule,
            source: canonicalSourceLocation(provenance.source),
          },
    to: relationship.to,
  });
}

function canonicalSourceStart(source: {
  readonly column: number;
  readonly line: number;
  readonly path: string;
}): string {
  return JSON.stringify(source);
}

function canonicalSourceLocation(source: {
  readonly path: string;
  readonly start: { readonly column: number; readonly line: number };
}): string {
  return canonicalSourceStart({
    column: source.start.column,
    line: source.start.line,
    path: source.path,
  });
}

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture expectation is incomplete');
  return value;
}

function sortStrings(values: readonly string[]): string[] {
  const sorted: string[] = [];
  for (const value of values) {
    const index = sorted.findIndex(
      (candidate) => candidate.localeCompare(value) > 0
    );
    if (index < 0) {
      sorted.push(value);
    } else {
      sorted.splice(index, 0, value);
    }
  }
  return sorted;
}

export function expectDocumentStructures(
  artifacts: readonly FlywheelArtifact[]
): void {
  const guide = artifactAt(artifacts, 'customer-wide/docs/release-guide.md');
  if (guide.kind !== 'document')
    throw new Error('guide fixture is not a Document');
  expect(guide.sections.map((section) => section.headingPath)).toEqual([
    ['Release guide'],
    ['Release guide', 'Procedure'],
  ]);
  expect(guide.sections[1]?.fragments.map((fragment) => fragment.kind)).toEqual(
    ['list', 'code', 'table', 'blockquote']
  );
}

export function entryAt(
  entries: readonly RepositoryEntry[],
  path: string
): RepositoryEntry | undefined {
  return entries.find((entry) => entry.path === path);
}
