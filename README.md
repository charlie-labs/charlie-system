# charlie-system

This repository currently contains a minimal placeholder CLI and package used
only to prove the Bun workspace wiring:

- [`clis/system-cli`](./clis/system-cli) is a placeholder CLI.
- [`packages/system-core`](./packages/system-core) is a placeholder package
  consumed by that CLI.

Both are temporary scaffolding. Delete both placeholder directories, including
these README files, as soon as the real CLI and package code are added to this
repository.

## `charlie-system` checkout and context

The Charlie harness always clones `charlie-system` at
`/home/user/.charlie/charlie-system/`. For all customers, the harness parses
and loads that checkout's `system/skills/` as the shared-system Skill root. It
does not load that checkout's `.agents/` tree for customer Tasks.

The harness loads `.agents/` only in a devbox where `charlie-system` is the
source repository cloned for work on `charlie-system`; there, `.agents/` is
repo-local to that repository and is not shared system content. There is no
`system/daemons/` root.
