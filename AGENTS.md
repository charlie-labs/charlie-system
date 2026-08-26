# Agent instructions

## Stack

This repository is a small strict ESM TypeScript monorepo managed with Bun.
Bun 1.3.14 is the package manager, and Node.js 22.22.1 or newer is supported.
The runtime versions and package metadata are authoritative in `package.json`.

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

The sample CLI at `clis/system-cli` consumes `@charlie-labs/system-core`
through a `workspace:*` dependency. Keep workspace coverage limited to
`clis/*` and `packages/*`.

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

Do not hand-edit `bun.lock`; regenerate it with Bun after changing manifests.

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

Also exercise `bun run precommit` with the intended files staged, and confirm
the required top-level paths and workspace package paths exist. Report any
check that could not be run and why.
