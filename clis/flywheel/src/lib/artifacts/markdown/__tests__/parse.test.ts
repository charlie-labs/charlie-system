import { expect, test } from 'bun:test';

import { parseMarkdown } from '../parse.js';

const markdown = `---
purpose: Explains releases.
reviewEvery: 90d
---
# Release guide

Read the [runbook](../runbook.md) before release.[^evidence]

## Procedure

1. Prepare the release.
   - Check the [dashboard](https://example.com/dashboard).
2. Deploy it.

\`\`\`sh
echo "[not a link](https://example.com/ignored)"
\`\`\`

| Step | Owner |
| --- | --- |
| Deploy | Platform |

[^evidence]: Confirm with the [change](https://github.com/acme/api/pull/7).
`;

const incompleteCitation = `# Citation

This citation has no definition.[^missing]

This is escaped and remains prose: \\[^literal].
`;

test('normalizes source-faithful GFM structure and references once', () => {
  const parsed = parseMarkdown(markdown, 'customer-wide/docs/releases.md');

  expect(parsed.frontmatter?.value).toContain('reviewEvery: 90d');
  expect(parsed.body.startsWith('# Release guide')).toBe(true);
  expect(
    parsed.sections.map((section) => ({
      anchor: section.target.anchor,
      headingPath: section.headingPath,
    }))
  ).toEqual([
    { anchor: 'release-guide', headingPath: ['Release guide'] },
    {
      anchor: 'procedure',
      headingPath: ['Release guide', 'Procedure'],
    },
  ]);
  expect(parsed.sections[0]?.fragments[0]).toMatchObject({
    citationKeys: ['evidence'],
    kind: 'prose',
  });
  expect(
    parsed.sections[1]?.fragments.map((fragment) => fragment.kind)
  ).toEqual(['list', 'code', 'table']);
  expect(parsed.citations).toHaveLength(1);
  expect(parsed.citations[0]?.key).toBe('evidence');
  expect(
    parsed.authoredReferences.map((reference) => ({
      citationKey: reference.citationKey,
      raw: reference.raw,
      relationship: reference.relationship,
    }))
  ).toEqual([
    {
      citationKey: undefined,
      raw: '../runbook.md',
      relationship: 'links-to',
    },
    {
      citationKey: undefined,
      raw: 'https://example.com/dashboard',
      relationship: 'links-to',
    },
    {
      citationKey: 'evidence',
      raw: 'https://github.com/acme/api/pull/7',
      relationship: 'cites',
    },
  ]);
  expect(parsed.authoredReferences[0]?.source).toMatchObject({
    path: 'customer-wide/docs/releases.md',
    start: { line: 7 },
  });
});

test('makes section anchors globally unique across derived collisions', () => {
  const parsed = parseMarkdown(
    '# Foo\n\n## Foo 1\n\n## Foo\n',
    'customer-wide/docs/collisions.md'
  );

  expect(parsed.sections.map((section) => section.target.anchor)).toEqual([
    'foo',
    'foo-1',
    'foo-2',
  ]);
});

test('collects nested authored Markdown reference definitions', () => {
  const parsed = parseMarkdown(
    `> [quote-ref]: https://example.test/quote\n> [quote][quote-ref]\n\n- item\n\n  [list-ref]: https://example.test/list\n\n  [list][list-ref]\n\n[^evidence]: Evidence.\n\n    [footnote-ref]: https://example.test/footnote\n\n    [footnote][footnote-ref]\n`,
    'customer-wide/docs/nested-definitions.md'
  );

  expect(
    parsed.authoredReferences.map((reference) => ({
      citationKey: reference.citationKey,
      raw: reference.raw,
    }))
  ).toEqual([
    { citationKey: undefined, raw: 'https://example.test/quote' },
    { citationKey: undefined, raw: 'https://example.test/list' },
    { citationKey: 'evidence', raw: 'https://example.test/footnote' },
  ]);
});

test('retains unresolved citation usage without exposing Markdown syntax', () => {
  const parsed = parseMarkdown(
    incompleteCitation,
    'customer-wide/docs/citation.md'
  );

  expect(parsed.sections[0]?.fragments[0]).toMatchObject({
    citationKeys: ['missing'],
    kind: 'prose',
  });
  expect(parsed.sections[0]?.fragments[1]).toMatchObject({
    citationKeys: [],
    kind: 'prose',
  });
});

test('uses the full preceding backslash-run parity for unresolved citations', () => {
  const parsed = parseMarkdown(
    String.raw`# Citation

An odd run escapes the citation: \[^odd].

An even run leaves a citation: \\[^even].

Three backslashes escape the citation: \\\[^three].

Four backslashes leave a citation: \\\\[^four].
`,
    'customer-wide/docs/escape-parity.md'
  );

  expect(
    parsed.sections[0]?.fragments.map((fragment) =>
      fragment.kind === 'prose' ? fragment.citationKeys : []
    )
  ).toEqual([[], ['even'], [], ['four']]);
});
