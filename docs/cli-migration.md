# CLI and package migration

This repository is the source-owned home for the migrated agent-facing CLIs
and their supporting packages. Keep migration work limited to these paths:

- `clis/apply-patch`
- `clis/ch-linear`
- `clis/ch-outline`
- `clis/ch-sentry`
- `clis/ch-slack`
- `packages/format-for`
- `packages/oclif-plugin-helpers`
- `packages/oclif-plugin-helpers-zod3`

## Rules

- Keep each workspace private and do not bring over npm publication, release,
  package-local Husky, or repository-specific toolchain configuration.
- Do not add direct ESLint or Prettier dependencies or invoke either tool from
  workspace scripts.
- Use the root Bun, TypeScript, Oxfmt, Oxlint, and Knip configuration. The
  temporary migrated-path exceptions are scoped and must be removed during
  final standardization.
- Use `workspace:*` for dependencies on other local workspaces. Public
  third-party dependencies remain regular npm dependencies.
- Use `zod` for Zod 4 and `zod3` only for temporary Zod 3 compatibility.
- Expose agent-facing commands only through root `bin/`; keep the executable,
  source, tests, and help behavior in this checkout.
- Preserve existing command behavior, exit codes, stdout/stderr contracts,
  credential boundaries, and correctness tests while moving source.

Validate the root quality commands and the repository contract tests before
opening a migration PR. Do not migrate `flywheel` or `ch-pr-review` here.
