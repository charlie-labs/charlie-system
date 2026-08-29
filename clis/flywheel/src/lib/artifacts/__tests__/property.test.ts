import { expect, test } from 'bun:test';

import {
  type ArtifactMetadataExample,
  artifactMetadataArbitrary,
  authoredReferenceArbitrary,
  headingAnchorArbitrary,
  secretBearingUrlArbitrary,
  sourceLocationArbitrary,
  urlArbitrary,
} from '../../__tests__/arbitraries.js';
import { fc } from '../../__tests__/fast-check.js';
import { assertParserProperty } from '../../__tests__/test-property.js';
import { constructAuthoredReference } from '../authored-reference.js';
import { parseArtifact } from '../dispatch.js';
import { parseDocumentArtifact } from '../document/parse.js';
import { artifactInput } from './parse-input.js';

test('parser totality keeps arbitrary bytes as parsed or visible unparsed data', () => {
  assertParserProperty(
    fc.property(
      fc.constantFrom('catalog', 'daemon', 'document', 'role', 'skill'),
      fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 96 }),
      (artifactKind, bytes) => {
        const entry = artifactInput(
          artifactKind,
          'customer-wide/docs/generated.md',
          ''
        ).entry;
        const compilation = parseArtifact({
          bytes: new Uint8Array(bytes),
          entry,
        });

        expect(compilation.entry).toEqual(entry);
        if (compilation.kind === 'unparsed') {
          expect(compilation.problems.length).toBeGreaterThan(0);
        } else {
          expect(
            compilation.artifacts.every(
              (artifact) =>
                artifact.path === entry.path && artifact.region === entry.region
            )
          ).toBe(true);
        }
      }
    )
  );
});

test('valid generated document metadata yields deterministic, unambiguous targets', () => {
  assertParserProperty(
    fc.property(
      artifactMetadataArbitrary,
      fc.array(headingAnchorArbitrary, { minLength: 1, maxLength: 4 }),
      (metadata, headings) => {
        const contents = documentContents(metadata, headings);
        const first = parseDocumentArtifact(
          artifactInput('document', 'customer-wide/docs/generated.md', contents)
        );
        const second = parseDocumentArtifact(
          artifactInput('document', 'customer-wide/docs/generated.md', contents)
        );

        expect(first).toEqual(second);
        expect(first.kind).toBe('parsed');
        if (first.kind !== 'parsed') return;
        expect(first.problems).toEqual([]);
        const artifact = first.artifacts[0];
        if (artifact?.kind !== 'document') return;
        const ids = artifact.sections.map((section) => section.target.anchor);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids[0]).toBe(headings[0]?.anchor);
        expect(artifact.target).toEqual({
          kind: 'document',
          path: 'customer-wide/docs/generated.md',
        });
      }
    )
  );
});

test('secret-bearing generated URLs are rejected without leaking their values', () => {
  assertParserProperty(
    fc.property(secretBearingUrlArbitrary, (url) => {
      const compilation = parseDocumentArtifact(
        artifactInput(
          'document',
          'customer-wide/docs/secret.md',
          `---\npurpose: Protect secrets.\nreviewEvery: 90d\n---\n# Safe\n\n[private](${url})\n`
        )
      );

      expect(compilation.kind).toBe('unparsed');
      expect(JSON.stringify(compilation)).not.toContain(url);
      expect(JSON.stringify(compilation)).not.toContain('access_token');
    })
  );
});

test('valid generated authored references remain source-faithful', () => {
  assertParserProperty(
    fc.property(authoredReferenceArbitrary, (input) => {
      const construction = constructAuthoredReference(input);
      expect(construction).toEqual({ kind: 'accepted', reference: input });
    })
  );
});

test('generated external references preserve their URL and source location', () => {
  assertParserProperty(
    fc.property(urlArbitrary, sourceLocationArbitrary(), (url, source) => {
      expect(
        constructAuthoredReference({
          raw: url,
          relationship: 'links-to',
          source,
        })
      ).toEqual({
        kind: 'accepted',
        reference: { raw: url, relationship: 'links-to', source },
      });
    })
  );
});

function documentContents(
  metadata: ArtifactMetadataExample,
  headings: readonly { readonly anchor: string; readonly heading: string }[]
): string {
  const frontmatter = [
    '---',
    `purpose: ${metadata.purpose}`,
    `reviewEvery: ${metadata.reviewEvery}`,
    ...(metadata.about.length === 0
      ? []
      : [`about: ${metadata.about.join(', ')}`]),
    ...(metadata.status === 'active' ? [] : [`status: ${metadata.status}`]),
    ...(metadata.replacedBy === undefined
      ? []
      : [`replacedBy: ${metadata.replacedBy}`]),
    '---',
  ];
  return [
    ...frontmatter,
    `# ${headings[0]?.heading ?? 'Generated guide'}`,
    '',
    'Generated body.',
    ...headings
      .slice(1)
      .flatMap(({ heading }) => ['', `## ${heading}`, '', 'More detail.']),
    '',
  ].join('\n');
}
