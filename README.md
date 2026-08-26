# charlie-system

This repository currently contains a minimal placeholder CLI and package used
only to prove the Bun workspace wiring:

- [`clis/system-cli`](./clis/system-cli) is a placeholder CLI.
- [`packages/system-core`](./packages/system-core) is a placeholder package
  consumed by that CLI.

Both are temporary scaffolding. Delete both placeholder directories, including
these README files, as soon as the real CLI and package code are added to this
repository.

## Mounted system checkout semantics

When this checkout is mounted as `charlie-system`, `system/skills` is the
shared-system Skill root. A mounted checkout contributes no root
`.agents/daemons/**` content to a customer's daemon inventory. When
`charlie-system` itself is the active task repository, root `.agents/skills`
and `.agents/daemons` are repo-local and eligible normally. There is no
`system/daemons` root.
