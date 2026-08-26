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

## Mounted system checkout semantics

When this checkout is mounted as `charlie-system`, `system/skills` is the
shared-system Skill root. A mounted checkout contributes no root
`.agents/daemons/**` content to a customer's daemon inventory. When
`charlie-system` itself is the active task repository, root `.agents/skills`
and `.agents/daemons` are repo-local and eligible normally. There is no
`system/daemons` root.
