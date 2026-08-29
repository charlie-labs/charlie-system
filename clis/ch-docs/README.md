# `ch-docs`

`ch-docs` is the private shared CLI for reading the current Charlie reference
documentation and submitting documentation maintenance feedback.

## Commands

```text
ch-docs page <path-or-url>
ch-docs index
ch-docs full
ch-docs search <query>
ch-docs filesystem <read-only-command>
ch-docs feedback <path-or-url> <feedback...>
```

- `page` reads one complete page. The argument may be a site-relative path or
  an HTTPS URL on the fixed documentation origin.
- `index` reads `llms.txt`.
- `full` reads `llms-full.txt`.
- `search` searches the documentation for a query.
- `filesystem` runs a supported read-only documentation filesystem command.
- `feedback` submits documentation feedback for a page.

The fixed documentation origin is
`https://charlie-v3.mintlify.site`. Search and filesystem use the
`search_charlie_labs` and `query_docs_filesystem_charlie_labs` MCP tools.
Feedback uses the `submit_feedback` MCP tool.

## Output

Human-mode successful commands write the returned documentation content as
intentional plaintext to stdout. Errors and diagnostics are written to stderr.
Use `--json` for one stable JSON result with the shape `{ "content": "..." }`;
JSON errors use the shared CLI error format. Standard `--help` and `--version`
are also available.

The retrieval commands are read-only. `feedback` is write-capable,
non-idempotent, and is never retried after an ambiguous request failure.

## Qualification

The opt-in, read-only MCP smoke is documented with the Flywheel qualification
suites in
[`../flywheel/qualification/README.md`](../flywheel/qualification/README.md).
Run `RUN_LIVE_QUALIFICATION=true bun run --cwd clis/ch-docs qualification:mcp-smoke`
only when a live service check is intended. Without the opt-in variable it
skips successfully.
