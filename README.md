# charlie-system

This repository contains the internal Flywheel CLI workspace and the shared
system checkout contents:

- [`clis/flywheel`](./clis/flywheel) is the oclif v4 Flywheel CLI foundation.
- [`system/skills`](./system/skills) is the shared-system Skill root when this
  checkout is mounted for customer Tasks.

The Flywheel foundation currently exposes oclif-generated root help and keeps
repository-path resolution plus asynchronous filesystem/process dependencies
ready for later read-only commands. The default repository path is
`/home/user/.charlie/customer-knowledge`; no general configuration file or
Task/customer context is read.

## Mounted system checkout semantics

When this checkout is mounted as `charlie-system`, `system/skills` is the
shared-system Skill root. A mounted checkout contributes no root
`.agents/daemons/**` content to a customer's daemon inventory. When
`charlie-system` itself is the active task repository, root `.agents/skills`
and `.agents/daemons` are repo-local and eligible normally. There is no
`system/daemons` root.
