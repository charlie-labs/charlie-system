# Agent instructions

## Stack

The repository uses Bun workspaces, Oxfmt, Oxlint, Knip, Husky, and
lint-staged. Keep the baseline focused on the root scripts and the two sample
workspace packages.

## Layout

- `clis/*`: executable Bun command-line packages.
- `packages/*`: reusable workspace packages.
- `.github/workflows/ci.yml`: pull request and `master` branch checks.
- `.husky/pre-commit`: local staged-file checks.
- `package.json`: workspace, dependency, and script source of truth.
- `bunfig.toml`: Bun installation policy.
- `tsconfig.json`: shared TypeScript checking configuration.

## `charlie-system` checkout and context

The Charlie harness always clones `charlie-system` at
`/home/user/.charlie/charlie-system/`. For all customers, the harness parses
and loads that checkout's `system/skills/` as the shared-system Skill root. It
does not load that checkout's `.agents/` tree for customer Tasks.

The harness loads `.agents/` only in a devbox where `charlie-system` is the
source repository cloned for work on `charlie-system`; there, `.agents/` is
repo-local to that repository and is not shared system content. There is no
`system/daemons/` root.

## Commands

Use Bun for package and script operations.

| Command             | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `bun ci`            | Install exactly from `bun.lock`.                          |
| `bun run fmt`       | Format supported files with Oxfmt.                        |
| `bun run fmt:check` | Check formatting without modifying files.                 |
| `bun run lint`      | Run Oxlint locally.                                       |
| `bun run lint:fix`  | Apply supported Oxlint fixes.                             |
| `bun run knip`      | Check unused files, dependencies, exports, and cycles.    |
| `bun run typecheck` | Run the repository TypeScript check.                      |
| `bun run cli`       | Run the sample system CLI.                                |
| `bun run precommit` | Run lint-staged and Knip as the pre-commit gate.          |
| `bun run check`     | Run formatting, lint, Knip, typecheck, and the CLI proof. |

## Guardrails

Oxfmt, Oxlint, Knip, TypeScript, Bun, Husky/lint-staged, package scripts, and
CI are human-owned quality policy. Fix code to comply; do not weaken rules,
add ignores or suppressions, use unsafe type escapes, narrow test/type
coverage, or make checks tolerate failures. Any change to these configs or
their enforcement requires explicit human approval for that exact
change—a request to implement or fix code does not imply approval. If a
guardrail appears wrong, leave it unchanged, explain the conflict, propose the
smallest change, and wait for approval.

Sources: [.oxfmtrc.json](./.oxfmtrc.json),
[oxlint.config.ts](./oxlint.config.ts), [knip.ts](./knip.ts),
[tsconfig.json](./tsconfig.json), [bunfig.toml](./bunfig.toml),
[lint-staged.config.ts](./lint-staged.config.ts), [package.json](./package.json),
and [CI](./.github/workflows/ci.yml).

Use Bun, not npm, pnpm, or Yarn. Do not hand-edit `bun.lock`.

## Handoff

Before handing off changes, run:

```sh
bun ci
bun run fmt:check
bun run lint
bun run knip
bun run typecheck
bun run cli
git diff --check
```
