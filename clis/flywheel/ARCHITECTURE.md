# Flywheel CLI architecture

The Flywheel CLI treats the customer knowledge repository as canonical authored
source. Inspection commands consume that source through a small set of
composable library boundaries; they do not establish competing interpretations
of repository layout, artifact identity, references, or validity. The explicit
`content setup` commands are the separate bootstrap boundary: they copy only
missing entries from package-owned scaffold trees into the selected knowledge
repository and do not compile, validate, compare, repair, or publish content.
The operation requires that its package scaffold and selected destination are
not concurrently mutated; static symbolic-link and path checks are not a claim
of race safety outside that precondition.

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
- The setup boundary owns package-scaffold traversal and create-only writes to
  the selected knowledge repository. It does not read source-repository
  checkouts or existing destination file bytes. Setup assumes no concurrent
  mutation of the scaffold or destination during one operation; its static
  symbolic-link and path checks do not provide a stronger race guarantee.
- Artifact components own their public artifact contract and parser. Parser
  implementation types, including Markdown AST types, remain private.
- Reference resolution owns the distinction between authored references and
  resolved targets. Resolution enriches authored evidence; it does not replace
  it.
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

A component boundary should represent independently changing semantics with a
contract that can be tested in isolation. It should not exist merely to wrap a
helper or create a directory. Artifact components may keep specialized local
types, while types shared across a real boundary are owned by the boundary's
public contract.

## Authority and provenance

Compilation may normalize repository paths, construct canonical identities,
and resolve references, but it must preserve the evidence from which those
values were derived. Authored references and resolved references are distinct
values, and every derived relationship identifies its authored or structural
provenance.

External targets may exist as identities and graph neighbors without fetching
their live content. Likewise, retrieval results present source-authored content
and locations rather than generated summaries presented as source material.
Derived state must never silently rewrite or reinterpret canonical content.

## Invariants

1. Canonical authored files remain authoritative. Indexes, caches, search
   passages, and other projections are derived and replaceable.
2. Repository regions form a closed set. Each path is classified exactly once
   as a recognized artifact, artifact support, Flywheel tooling state,
   prohibited content, visible unsupported content, or ordinary repository
   infrastructure outside the governed regions. Downstream stages consume the
   classification instead of rediscovering regions from path strings.
3. Support files inherit the ownership and eligibility of their containing
   artifact, but are not independently parsed artifacts.
4. Repository paths are Charlie-relative, normalized, and prevented from
   escaping the selected repository root.
5. Repository selection is explicit. Library behavior must not depend on
   ambient customer, source-repository, Task, or provider context.
6. One operation observes one repository-source state. Files are listed and
   read through batch-capable boundaries so implementations do not require a
   process or parser setup per file.
7. Canonical file bytes are parsed at most once per compilation. Downstream
   stages consume typed results rather than rereading or reparsing source.
8. Canonical artifacts form a discriminated union with explicit required
   fields rather than a general model made from optional properties. Parsers
   return normalized plain data, source locations, authored references, and
   parse problems.
9. Canonical target identifiers and aliases are constructed centrally and
   deterministically.
10. Ordering and diagnostics are deterministic for identical source input.
11. Missing, unsupported, prohibited, unresolved, and unparsed material remains
    visible in the model or diagnostics; it is not silently discarded.
12. The graph contains semantic targets, relationships, adjacency, aliases, and
    provenance. It does not contain diagnostics, retrieval scores, rendering
    state, mutation plans, or cache metadata.
13. A graph or projection may be constructed from incomplete input, but
    retrieval must not rely on it until validation has produced an explicit
    usable assessment.
14. Invalid or incomplete input must not become an apparently successful empty
    result. Whether an operation fails or returns partial results is an
    explicit part of that operation's contract.
15. Command output is a final boundary. Operations return structured values
    before rendering, and rendered text does not feed back into repository
    semantics.

## Operation contracts

Exact source inspection, artifact lookup, relationship traversal, and ranked
retrieval share repository authority but retain separate contracts:

- exact text search consumes the permitted repository inventory and bypasses
  semantic parsing, graph construction, validation, and ranking;
- artifact lookup resolves known Flywheel identities rather than treating
  arbitrary external identities as inspectable local content;
- relationship traversal consumes the graph and may return unresolved or
  external identities without fetching them; and
- ranked retrieval consumes eligible source-authored knowledge together with
  an explicit validation assessment.
- setup copies an inspectable package-owned scaffold tree, leaves existing
  destination entries unchanged, and returns deterministic copied/skipped
  paths without performing validation, source-checkout reads, or Git
  operations. It reports the explicit source-repository directory manifest as
  created or reused roots rather than treating it as destination content.

For ranked retrieval, repository, lifecycle, and content-type eligibility is
applied before candidate limits or ranking cutoffs. Backend candidates remain
distinct from public results. User-visible limits count artifacts rather than
internal passages, and passages remain grouped beneath their source artifact.
Only citations used by returned passages are included.

Structured results keep truncation, omissions, incomplete projections,
validation problems, and backend failures visible. Different commands may
choose different fail-versus-partial behavior, but none may erase those states
by presenting them as an ordinary empty result.

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

Full compilation is an orchestration capability, not the only library API.
Deterministic stages remain independently callable so operations can stop at
the narrowest sufficient representation and future implementations can replace
an expensive stage without changing repository semantics.

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

Target and alias indexes should be constructed before reference resolution,
and graph adjacency should be constructed once rather than rebuilt for each
traversal. Consumers must not reread or reparse canonical files when an
upstream value already contains the required information. These are structural
properties of the pipeline, not commitments to a particular optimization.

Do not add persistent caches, invalidation state, content hashes, watchers,
incremental dependency tracking, plugin systems, or backend abstractions until
measured behavior and a concrete use case require them.

Caching must remain insertable between deterministic stages, but no
cache-specific metadata belongs in canonical component outputs before an
implemented optimization requires it. Retrieval backends remain replaceable
and must not redefine Flywheel eligibility, identity, provenance, or result
semantics.

Directory boundaries provide the initial modularity. A separate workspace
package, plugin mechanism, or other abstraction is justified only by a real
second consumer, deployment boundary, or independently changing
responsibility—not by hypothetical future reuse.

## Testing

Each component owns focused tests for its local semantics. Boundary tests cover
the values exchanged between components, and a small number of end-to-end
fixtures prove composition across stages. CLI tests concentrate on argument
handling, exit behavior, and rendering rather than duplicating library tests.

Setup tests additionally cover create-only copying, empty directories,
structural mismatches, symbolic-link rejection, traversal rejection, identity
normalization, directory-manifest roots, exact production scaffold inventory,
repeated no-op behavior, preservation, substitutions, no source-checkout or
Git access, and JSON/human output separation. Concurrent filesystem mutation is
outside the setup guarantee and is not treated as a tested success condition.

Setup intentionally does not validate the resulting repository. The later
`content validate` command is the gate for artifact, placement, reference,
graph, and freshness validity before a separate durable Git operation.

Performance-sensitive invariants should be proved structurally where possible:
one source listing per operation, batch reads, parse-once compilation, and no
per-file subprocess requirement.
