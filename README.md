# charlie-system

This repository contains the internal Flywheel CLI workspace and the shared
system checkout contents:

- [`clis/flywheel`](./clis/flywheel) is the oclif v4 Flywheel CLI foundation.
- [`system/skills`](./system/skills) is the shared-system Skill root when this
  checkout is mounted for customer Tasks.

The checkout exposes exactly four read-only Flywheel commands:
`content rg`, `content validate`, `skill preset list`, and
`skill preset show <preset>`. The executable and integration proof live under
[`clis/flywheel`](./clis/flywheel); no other CLI is introduced here.

The default repository path is `/home/user/.charlie/customer-knowledge`.
Pass `--repository-path` for a test or development repository. The CLI does
not read a general configuration file or ambient Task, customer, provider,
source-repository, or transcript context.

Run the checkout-local executable and its proof with:

```sh
bun run cli --help
bun run test:flywheel
```

## `charlie-system` checkout and context

The Charlie harness always clones `charlie-system` at
`/home/user/.charlie/charlie-system/`. For all customers, the harness parses
and loads that checkout's `system/skills/` as the shared-system Skill root. It
does not load that checkout's `.agents/` tree for customer Tasks.

The harness loads `.agents/` only in a devbox where `charlie-system` is the
source repository cloned for work on `charlie-system`; there, `.agents/` is
repo-local to that repository and is not shared system content. There is no
`system/daemons/` root.
