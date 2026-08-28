---
name: charlie-docs
description: Read Charlie Labs public documentation for product concepts, Customer Guides, Charlie Reference, setup, integrations, configuration, and troubleshooting using live indexes, Markdown pages, and read-only search helpers.
---

# Charlie Docs

Use this Skill when a Task needs authoritative information from Charlie Labs' public documentation, including product concepts, Customer Guides, Charlie Reference, setup, integrations, configuration, or troubleshooting. The live documentation is the authority for current public behavior; prior knowledge and search snippets are leads, not substitutes for reading the relevant page.

## Retrieval workflow

1. Start with `GET https://docs.charlielabs.ai/llms.txt`. It is the live indexed discovery surface: follow the page URLs it returns, but do not assume it contains every publicly reachable page.
2. For exact or freshness-sensitive reading, fetch a page URL from the index with `Accept: text/markdown`, or use the exact `.md` URL returned by the index. Do not blindly append `.md` to an arbitrary URL.
3. `https://docs.charlielabs.ai/llms-full.txt` is a bulk indexed corpus useful for broad local searching. It may be cached, transform some MDX, and omit image sources, so it does not replace page-level Markdown for exact reading.
4. After using search excerpts, retrieve the complete relevant page. If the index or excerpt is incomplete, follow relevant owning links from the page and continue reading until the answer is supported.

## Read-only helper

Use the bundled helper for repetitive transport mechanics, while keeping retrieval judgment in the workflow above:

```text
bun system/skills/charlie-docs/scripts/charlie-docs.ts page <path-or-url>
bun system/skills/charlie-docs/scripts/charlie-docs.ts index
bun system/skills/charlie-docs/scripts/charlie-docs.ts full
bun system/skills/charlie-docs/scripts/charlie-docs.ts search <query>
bun system/skills/charlie-docs/scripts/charlie-docs.ts filesystem <read-only-command>
```

`search` is for broad semantic discovery. `filesystem` is for exact matching or reading a page exposed by the documentation filesystem, such as `rg`, `head`, or `cat`. Both commands are read-only and expose only the supported Charlie Labs search and documentation-filesystem operations. Use the returned links and page content to decide what to read next; the helper does not replace that judgment.
