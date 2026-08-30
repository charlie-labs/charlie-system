# `flywheel`

The internal Flywheel CLI is the command-line entrypoint for inspecting and
initializing checkout-local Flywheel content.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the durable component boundaries,
invariants, and performance posture that guide implementation.

The current CLI provides these inspection commands and setup commands:

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
that writes: it creates absent scaffold directories and `.gitkeep` marker
files, leaves every existing destination entry unchanged, and reports copied
and skipped paths. Setup does not read source-repository checkouts, validate,
commit, or push. The CLI does not read or modify source repositories,
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
package-owned scaffold roots. Their `.gitkeep` marker files make otherwise
empty scaffold directories preservable when a caller later creates a Git
commit. The source-repository identity is normalized as `owner/name`; setup
does not invoke Git itself.

## Qualification

Offline relevance and performance qualification suites are documented in
[`qualification/README.md`](./qualification/README.md). They are explicit,
non-blocking commands and are not included in the ordinary check or CI
workflow.
