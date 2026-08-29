import type { DocumentMetadata } from '../artifacts/document/contract.js';
import type { GraphRelationship, RepositoryGraph } from '../graph/contract.js';
import type {
  AuthoredReference,
  RelationshipKind,
} from '../references/contract.js';
import { sourceLocation, type SourceLocation } from '../repository/location.js';
import type { KnowledgeSourceUnit } from '../retrieval/corpus/contract.js';
import type { ExactSearchScope } from '../retrieval/exact/arguments.js';
import type { PassageCandidate } from '../retrieval/search/candidate-source.js';
import { fc } from './fast-check.js';

const identifierArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/u);
const sentenceArbitrary = fc.stringMatching(
  /^[A-Za-z][A-Za-z0-9 .,!?-]{0,32}$/u
);

export const governedPathArbitrary = fc.oneof(
  fc
    .tuple(
      fc.constantFrom('customer-wide/docs', 'customer-wide/catalog', 'roles'),
      identifierArbitrary,
      fc.constantFrom('.md', '.yaml', '.yml')
    )
    .map(([root, name, extension]) => `${root}/${name}${extension}`),
  fc
    .tuple(
      fc.constantFrom(
        'customer-wide/.agents/daemons',
        'customer-wide/.agents/skills',
        'core/.agents/daemons'
      ),
      identifierArbitrary
    )
    .map(([root, name]) => `${root}/${name}/DAEMON.md`),
  fc
    .tuple(fc.constant('customer-wide/.agents/skills'), identifierArbitrary)
    .map(([root, name]) => `${root}/${name}/SKILL.md`),
  fc
    .tuple(
      fc.constantFrom(
        'repo-specific/acme/api/docs',
        'repo-specific/acme/api/catalog'
      ),
      identifierArbitrary,
      fc.constantFrom('.md', '.yaml')
    )
    .map(([root, name, extension]) => `${root}/${name}${extension}`)
);

export type ArtifactMetadataExample = Pick<
  DocumentMetadata,
  'about' | 'purpose' | 'reviewEvery'
> &
  Readonly<{
    readonly replacedBy?: string;
    readonly status: 'active' | 'deprecated' | 'superseded';
  }>;

export const artifactMetadataArbitrary: fc.Arbitrary<ArtifactMetadataExample> =
  fc
    .record({
      about: fc.array(
        identifierArbitrary.map((value) => `component:default/${value}`),
        {
          maxLength: 2,
        }
      ),
      purpose: sentenceArbitrary,
      reviewEvery: fc.constantFrom('30d', '90d', '180d'),
      status: fc.constantFrom<'active' | 'deprecated' | 'superseded'>(
        'active',
        'deprecated',
        'superseded'
      ),
    })
    .map((metadata) =>
      metadata.status === 'superseded'
        ? {
            about: metadata.about,
            purpose: metadata.purpose,
            replacedBy: './replacement.md',
            reviewEvery: metadata.reviewEvery,
            status: metadata.status,
          }
        : metadata
    );

export const headingAnchorArbitrary = sentenceArbitrary.map((heading) => ({
  anchor:
    heading
      .trim()
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
      .replaceAll(/[\s_]+/gu, '-') || 'section',
  heading,
}));

export const urlArbitrary = fc
  .tuple(
    identifierArbitrary,
    identifierArbitrary,
    fc.option(identifierArbitrary)
  )
  .map(
    ([host, path, reference]) =>
      `https://${host}.example.test/${path}${
        reference === null ? '' : `?ref=${reference}`
      }`
  );

export const secretBearingUrlArbitrary = fc
  .tuple(identifierArbitrary, identifierArbitrary)
  .map(
    ([path, secret]) => `https://example.test/${path}?access_token=${secret}`
  );

export const authoredReferenceArbitrary: fc.Arbitrary<AuthoredReference> = fc
  .record({
    raw: fc.oneof(
      urlArbitrary,
      governedPathArbitrary.map((path) => `./${path}`)
    ),
    relationship: fc.constantFrom<RelationshipKind>(
      'about',
      'cites',
      'links-to'
    ),
    source: sourceLocationArbitrary(),
  })
  .map(({ raw, relationship, source }) => ({
    raw,
    relationship,
    source,
  }));

export function exactSearchArgsArbitrary(
  scope: ExactSearchScope
): fc.Arbitrary<readonly string[]> {
  const admittedPaths = [...scope.directories, ...scope.files];
  return fc
    .record({
      delimiter: fc.boolean(),
      option: fc.constantFrom<readonly string[]>(
        [],
        ['-i'],
        ['--fixed-strings']
      ),
      path: fc.option(fc.constantFrom(...admittedPaths)),
      pattern: identifierArbitrary,
    })
    .map(({ delimiter, option, path, pattern }) => {
      const args: string[] = [];
      for (const argument of option) args.push(argument);
      args.push(pattern);
      if (delimiter) args.push('--');
      if (path !== null) args.push(path);
      return args;
    });
}

export function graphFragmentArbitrary(
  graph: RepositoryGraph
): fc.Arbitrary<GraphRelationship> {
  return fc.constantFrom(...graph.relationships);
}

export function retrievalCandidateArbitrary(
  units: readonly KnowledgeSourceUnit[]
): fc.Arbitrary<PassageCandidate> {
  return fc.constantFrom(...units).chain((unit) =>
    fc.integer({ min: 1, max: 100 }).map((score) => ({
      artifact: unit.artifact,
      score,
      unitId: unit.id,
    }))
  );
}

export function sourceLocationArbitrary(): fc.Arbitrary<SourceLocation> {
  return fc
    .record({
      column: fc.integer({ min: 1, max: 24 }),
      line: fc.integer({ min: 1, max: 24 }),
    })
    .map(({ column, line }) =>
      sourceLocation('customer-wide/docs/generated.md', { column, line })
    );
}
