# `flywheel`

The internal Flywheel CLI is the command-line entrypoint for inspecting and
explicitly initializing checkout-local Flywheel content.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the durable component boundaries,
invariants, and performance posture that guide implementation.

The current CLI provides these inspection commands and explicit setup commands:

- `knowledge search <query>`
- `content rg`
- `content show <target>`
- `content related <target>`
- `content validate`
- `content setup customer`
- `content setup source-repo <owner/name>`
- `skill preset list`
- `skill preset show <preset>`

Skill preset inspection reads only the inert sources under `presets/skills/`;
it never materializes or installs a preset. Setup is the only content command
that writes: it copies absent entries from inspectable, package-owned scaffold
trees, leaves every existing destination unchanged, and reports `copied` and
`skipped` paths. Setup never reads a source-repository checkout, compares
content, validates the resulting repository, commits, or pushes. Setup requires
that the package scaffold and selected destination are not concurrently mutated
while it runs; static symbolic-link and path checks do not claim race safety
outside that precondition. The CLI does not read or modify source repositories,
providers, tasks, transcripts, or lifecycle state.

## Development

Run the CLI from the repository root:

```sh
bun run cli --help
```

Run the executable proof from the repository root with:

```sh
bun run test:flywheel
```

The default repository path is `/home/user/.charlie/customer-knowledge`.
Use `--repository-path` to point at a checkout-local knowledge repository for
tests and development. `content rg` requires a literal `--` before the
ripgrep arguments; `content validate` is deterministic, offline, and
read-only. Use `content show <target>` to inspect one compiled artifact by
canonical target ID, alias, or local path; append a document-section anchor to
inspect that section, for example
`content show customer-wide/docs/guide.md#operations`. Add `--json` for the
structured inspection result, and place `--repository-path` before or after the
target. `knowledge search` ranks source-faithful Doc and Catalog passages
from explicit repository, lifecycle, and content-type scope; it does not use
ambient Task context or fetch external content. Invalid and incomplete
repository assessments fail closed instead of becoming empty or partial search
results. Use `skill preset list` to inspect available local Skill identities
and `skill preset show placeholder-skill` to print its payload and
specialization guidance. The package does not read a general configuration
file or ambient customer, source-repository, or Task context.

`content setup customer` and `content setup source-repo <owner/name>` use
package-owned scaffold roots and create only missing directories and files.
The customer scaffold currently installs the selected `pr-autopilot` Role and
its `pr-review` Daemon. The source-repository scaffold installs the minimal
customer-wide `customer-wide/catalog/repositories.yaml` Repository entity and
uses its package-owned `DIRECTORIES` manifest to retain the empty matching
`catalog`, `docs`, `.agents/daemons`, and `.agents/skills` roots that Git cannot
track by itself. The source-repository identity is normalized as `owner/name`;
scaffold paths use `__owner__` and `__name__`, while UTF-8 text may also use the
narrow `__repository_id__` token. Neither command reads the source repository
named by the argument. Both commands return `validationPerformed: false` and
the same copy report in JSON and human modes; run `content validate` before
treating the working tree as valid or durable.

## Qualification

Offline relevance and performance qualification suites are documented in
[`qualification/README.md`](./qualification/README.md). They are explicit,
non-blocking commands and are not included in the ordinary check or CI
workflow.
