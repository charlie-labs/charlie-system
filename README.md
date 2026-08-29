# charlie-system

See [`clis/flywheel/README.md`](./clis/flywheel/README.md) for Flywheel CLI
documentation.

The checkout-backed CLI surface lives in `bin/`. Consumers should prepend that
directory to `PATH`, for example:

```sh
export PATH="/home/user/.charlie/charlie-system/bin:$PATH"
flywheel --help
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
