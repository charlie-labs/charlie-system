# `flywheel`

The internal Flywheel CLI is the command-line entrypoint for inspecting
checkout-local Flywheel content.

This phase establishes the oclif v4 executable, repository-path resolution, and
injectable asynchronous filesystem/process seams. Leaf commands are added in
later phases; the foundation intentionally exposes only oclif-generated root
help today.

## Development

Run the CLI from the repository root:

```sh
bun run cli --help
```

The default repository path is `/home/user/.charlie/customer-knowledge`.
Later commands may provide an explicit repository-path override for tests and
development; this package does not read a general configuration file or
ambient customer, source-repository, or Task context.
