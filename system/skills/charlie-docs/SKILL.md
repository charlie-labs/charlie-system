---
name: charlie-docs
description: Read Charlie Labs public documentation for product concepts, Customer Guides, Charlie Reference, setup, integrations, configuration, and troubleshooting using live indexes, Markdown pages, and read-only search helpers.
---

# Charlie Docs

Use this Skill when a Task needs authoritative information from Charlie Labs' public documentation, including product concepts, Customer Guides, Charlie Reference, setup, integrations, configuration, or troubleshooting. The live documentation is the authority for current public behavior; prior knowledge and search snippets are leads, not substitutes for reading the relevant page.

## Retrieval workflow

Use the bundled helper from the repository root. It owns the documentation
retrieval details, so use its commands rather than reproducing requests
directly.

1. Start with `search <query>` for broad discovery when you know the topic but
   not the relevant page.
2. Use `index` to browse the live documentation index and find current page
   paths.
3. After discovery, use `page <path-or-url>` to read the complete relevant
   page. Do not treat search excerpts or index entries as a substitute for
   page-level reading.
4. If the index or search results are incomplete, follow relevant links from
   the returned page and continue reading until the answer is supported.

## Bundled helper commands

Run these commands with Bun:

```text
bun system/skills/charlie-docs/scripts/charlie-docs.ts page <path-or-url>
bun system/skills/charlie-docs/scripts/charlie-docs.ts index
bun system/skills/charlie-docs/scripts/charlie-docs.ts full
bun system/skills/charlie-docs/scripts/charlie-docs.ts search <query>
bun system/skills/charlie-docs/scripts/charlie-docs.ts filesystem <read-only-command>
```

- `page <path-or-url>` reads one complete documentation page and returns its
  page content.
- `index` returns the live documentation index for discovering current page
  paths and links.
- `full` returns the bulk documentation corpus for broad local searching. Use
  `page` afterward when you need the complete authoritative content of a
  specific page.
- `search <query>` searches the documentation and returns matching result
  content for topic discovery.
- `filesystem <read-only-command>` runs a supported read-only documentation
  filesystem command, such as `rg`, `head`, or `cat`, and returns its stdout.
  A failed command is reported as an error.

All helper commands are read-only. Use the returned results to decide what to
read next; the helper does not replace that judgment.
