# Flywheel CLI architecture

The Flywheel CLI treats the customer knowledge repository as canonical authored
source. Commands inspect that source through a small set of composable library
boundaries; they do not establish competing interpretations of repository
layout, artifact identity, references, or validity.

The fuller design and delivery rationale lives in
[`architecture-plan.md`](../../architecture-plan.md). This document records the
durable rules that implementations should preserve as the CLI evolves.

## Architectural flow

The library behaves like a small compiler whose stages can also be used
independently when an operation does not need the complete semantic model:

```text
repository source
  -> discovery and classification
  -> repository inventory
  -> typed artifact compilation
  -> reference resolution
  -> relationship graph
  -> repository validation
  -> command-specific projections
  -> rendering
```

Exact source inspection, artifact lookup, relationship traversal, and ranked
retrieval are distinct operations. For example, exact text search may consume a
repository inventory directly, while semantic retrieval must consume a
validated repository projection. Commands should request the narrowest stage
that satisfies their contract.

## Component boundaries

- The repository boundary owns paths, repository regions, repository
  identities, selections, source access, discovery, and entry classification.
- Artifact components own their public artifact contract and parser. Parser
  implementation types, including Markdown AST types, remain private.
- Reference resolution owns the distinction between authored references and
  resolved targets.
- Graph construction owns relationships and their provenance. Derived indexes
  are replaceable views, not canonical data.
- Validation consumes the repository projection. The projection never depends
  on validation.
- Retrieval and management capabilities consume upstream values without
  redefining repository or artifact semantics.
- CLI commands translate arguments into library inputs and render library
  results. Repository semantics do not live in command modules.

Public component outputs are plain values. A component exposes a narrow
contract rather than its local helper types, parser objects, filesystem
handles, or backend-specific state. There is no global shared-types module.

## Invariants

1. Canonical authored files remain authoritative. Indexes, caches, search
   passages, and other projections are derived and replaceable.
2. Repository regions form a closed set. Every discovered content entry is
   either a recognized artifact, artifact support, Flywheel tooling state,
   prohibited content, or visible unsupported content.
3. Repository paths are Charlie-relative, normalized, and prevented from
   escaping the selected repository root.
4. Repository selection is explicit. Library behavior must not depend on
   ambient customer, source-repository, Task, or provider context.
5. One operation observes one repository-source state. Files are listed and
   read through batch-capable boundaries so implementations do not require a
   process or parser setup per file.
6. Canonical file bytes are parsed at most once per compilation. Downstream
   stages consume typed results rather than rereading or reparsing source.
7. Ordering and diagnostics are deterministic for identical source input.
8. Missing, unsupported, prohibited, unresolved, and unparsed material remains
   visible in the model or diagnostics; it is not silently discarded.
9. A graph or projection may be constructed from incomplete input, but
   retrieval must not rely on it until validation has produced an explicit
   usable assessment.
10. Command output is a final boundary. Rendered text does not feed back into
    repository semantics.

## Dependency direction

Dependencies point from stable source concepts toward increasingly derived
capabilities:

```text
repository
  -> artifacts and targets
  -> reference resolution
  -> graph and projection
  -> validation
  -> retrieval and management capabilities
  -> CLI commands and renderers
```

Lower layers must not import higher layers. Components may depend on the public
contracts of earlier stages, but not on another component's internal helpers.

## Performance posture

The initial implementation favors clear stage boundaries and straightforward
data structures over speculative optimization. Those same boundaries must make
future optimization insertable:

- source access is replaceable and batch-oriented;
- compilation is decomposable by stage;
- canonical component outputs are plain values;
- expensive parsing is isolated behind artifact parsers;
- derived indexes are separate from canonical data; and
- commands depend on capabilities rather than a particular storage strategy.

Do not add persistent caches, invalidation state, content hashes, watchers,
incremental dependency tracking, plugin systems, or backend abstractions until
measured behavior and a concrete use case require them.

## Testing

Each component owns focused tests for its local semantics. Boundary tests cover
the values exchanged between components, and a small number of end-to-end
fixtures prove composition across stages. CLI tests concentrate on argument
handling, exit behavior, and rendering rather than duplicating library tests.

Performance-sensitive invariants should be proved structurally where possible:
one source listing per operation, batch reads, parse-once compilation, and no
per-file subprocess requirement.
