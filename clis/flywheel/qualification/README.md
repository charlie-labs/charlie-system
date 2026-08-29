# Flywheel qualification suites

These suites are explicit qualification surfaces. They are not ordinary
tests, are not included in `bun run check`, and are not part of the blocking
workflow in `.github/workflows/ci.yml`.

Operational owner: Flywheel maintainers (Riley).

| Suite                             | Trigger                                                             | Expected runtime         | Failure interpretation                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `qualification:retrieval`         | Manual, release qualification, or a scheduled offline run           | Usually under 5 seconds  | A command or corpus-integrity failure is actionable. Recall values are reported observations, not pass/fail thresholds.                      |
| `qualification:performance`       | Manual or scheduled comparison run                                  | Usually under 30 seconds | Structural/count or validation failures are actionable. Stage timings are environment-dependent reports, not blocking limits.                |
| `ch-docs qualification:mcp-smoke` | Manual or scheduled service-availability check with explicit opt-in | Usually under 10 seconds | An explicitly requested unavailable service is a failure to investigate; the suite performs one read-only search request and does not retry. |

## Retrieval relevance

The versioned corpus is
[`retrieval-corpus.v1.json`](./retrieval-corpus.v1.json). It reuses the
committed reference repository fixture and reports artifact-level Recall@K for
each query plus a macro-average for each K. The report includes retrieved and
relevant canonical artifact IDs so ranking changes can be inspected without
turning the versioned `artifact-recall-at-k-v1` metric into a hard threshold.

Run it from the repository root:

```sh
bun run --cwd clis/flywheel qualification:retrieval
```

Capture the JSON stdout as the qualification artifact. The suite is offline
and deterministic for the same source, corpus, and implementation.

## Performance scenario

The performance suite creates a deterministic temporary repository larger than
the committed fixture, then times the existing production stage boundaries
from discovery through aggregate retrieval. It emits bounded repository shape,
validation, retrieval, environment, and per-stage timing metadata. It does not
add production telemetry, caches, or timing thresholds.

Run it from the repository root:

```sh
bun run --cwd clis/flywheel qualification:performance
```

Use the report to compare stage behavior across known environments. A timing
regression is an investigation signal, not an automatic blocking failure.

## `charlie-docs` MCP smoke

The live smoke is opt-in and skipped successfully unless
`RUN_LIVE_QUALIFICATION=true` is set. With opt-in, it invokes only the existing
read-only `./bin/run.ts search` CLI path once for the `search_charlie_labs`
tool. It never invokes feedback or another write-capable tool, never retries,
and prints only bounded metadata rather than remote content or secrets.

Skip check:

```sh
bun run --cwd clis/ch-docs qualification:mcp-smoke
```

Explicit live check:

```sh
RUN_LIVE_QUALIFICATION=true bun run --cwd clis/ch-docs qualification:mcp-smoke
```

An explicit live request exits nonzero when the documentation service or MCP
transport is unavailable. The default skip is successful so normal local and
blocking CI checks remain offline.
