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
