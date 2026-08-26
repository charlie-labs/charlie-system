# `flywheel`

The internal Flywheel CLI is the command-line entrypoint for inspecting
checkout-local Flywheel content.

The CLI provides read-only `content rg` and `content validate` commands over
the supported Flywheel content slice. It does not read or modify source
repositories, providers, tasks, transcripts, or lifecycle state.

## Development

Run the CLI from the repository root:

```sh
bun run cli --help
```

The default repository path is `/home/user/.charlie/customer-knowledge`.
Use `--repository-path` to point at a checkout-local knowledge repository for
tests and development. `content rg` requires a literal `--` before the
ripgrep arguments; `content validate` is deterministic, offline, and
read-only. The package does not read a general configuration file or ambient
customer, source-repository, or Task context.
