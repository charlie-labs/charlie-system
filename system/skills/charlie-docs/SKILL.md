---
name: charlie-docs
description: Read current Charlie reference documentation. Use when work depends on Charlie's lifecycle, Signals and interaction/routing, durable Tasks, Runs, Turns, mailboxes, delegation, worker agents and Task trees, agent-harness behavior, Devboxes, repositories, tools/CLIs, capabilities, credentials, secrets and environment variables, Skills, Rules/instructions, Daemons, Roles, Flywheel Knowledge, maintenance/adaptation, GitHub/Linear/Slack/Sentry integrations, provider events/actions, setup, limits, evidence, or troubleshooting missing or unexpected work.
---

# Charlie Docs

This Skill gives Charlie—the agent built by Charlie Labs—authoritative, current reference documentation for its own operation. Use it when a Task depends on Charlie's lifecycle, Signals and interaction/routing, durable Tasks, Runs, Turns, mailboxes, delegation, worker agents and Task trees, agent-harness behavior, Devboxes, repositories, tools/CLIs, capabilities, credentials, secrets and environment variables, Skills, Rules/instructions, Daemons, Roles, Flywheel Knowledge, maintenance/adaptation, GitHub/Linear/Slack/Sentry integrations, provider events/actions, setup, limits, evidence, or troubleshooting missing or unexpected work. Treat the live documentation as the authority for current behavior; prior knowledge and search results are leads, not substitutes for reading the relevant page.

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
bun system/skills/charlie-docs/scripts/charlie-docs.ts feedback <path-or-url> <feedback...>
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

Use the returned results to decide what to read next; the helper does not
replace that judgment.

## Giving feedback

While using the documentation, proactively submit feedback when a page is
incorrect, outdated, confusing, incomplete, or contains a broken example. Do
not wait for a customer to report the problem. Use documentation feedback for
the page itself, not for a product support request, a product bug, a feature
request, or feedback about Charlie or this helper.

Feedback should report the problem, not solve it. Do not propose or specify a
fix, replacement wording, implementation, or documentation structure. Include:

- the affected page and precise context, such as a heading, table, paragraph,
  or example;
- what the page currently says or does and what is wrong;
- why the problem matters to a reader or operator; and
- supporting evidence, such as observed behavior, a version or date, or a
  source link, when available.

Feedback is a maintenance signal for the documentation team, not authority to
edit public documentation without verification. State what you observed and
avoid guessing about the remedy.

Submit feedback with:

```text
bun system/skills/charlie-docs/scripts/charlie-docs.ts feedback <path-or-url> <feedback...>
```

For example:

```text
bun system/skills/charlie-docs/scripts/charlie-docs.ts feedback /integrations/slack "Under `Thread follow-ups`, the page says every reply in an existing thread is treated as a continuation. In a shared channel, a reply that mentions @Charlie starts a new request instead, so this guidance can cause a follow-up to be missed. I observed this with the current Slack behavior; the routing reference describes mentions as explicit requests."
```

The retrieval commands (`page`, `index`, `full`, `search`, and
`filesystem`) are read-only. `feedback` is different: it creates an external
Mintlify feedback record.
