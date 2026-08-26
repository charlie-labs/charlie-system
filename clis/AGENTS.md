# CLI authoring rules

These instructions supplement [`../AGENTS.md`](../AGENTS.md) and apply to
every executable package under `clis/*`. Use Bun for package and script
operations; do not weaken the repository's existing quality gates.

## Standard

- Use oclif v4 with
  [`@charlie-labs/oclif-plugin-helpers`](https://github.com/charlie-labs/oclif-plugin-helpers).
- Keep commands thin: parse and validate input, call reusable library code,
  and own only CLI I/O. Do not extend oclif `Command` directly or override
  `run()` when `BaseCommand` applies.
- Use this shape unless an approved package constraint requires an equivalent:

  ```text
  bin/run.ts                 # tiny executable Bun shim
  src/cli/commands/<topic>/<verb>.ts
  src/cli/utils/              # CLI-only helpers
  src/lib/                    # reusable operations/services; no CLI imports
  ```

Read the [current CLI Authoring Reference](https://github.com/charlie-labs/charlie/blob/master/knowledge/docs/reference/cli-authoring-reference.md)
before adding a package.

## Entrypoint, configuration, and dependencies

- Keep `bin/run.ts` tiny, start with `#!/usr/bin/env bun`, and delegate to
  oclif. Use the helpers package `handle()` in the top-level catch chain when
  appropriate; map the executable in `package.json` and keep it executable.
- Read environment and configuration at the CLI boundary, document required
  variables and precedence, and pass typed configuration into `buildDeps()` or
  library functions. Do not make reusable library code depend on ambient
  process environment.
- Use `node:fs/promises` or Bun async APIs. Do not use synchronous filesystem
  APIs in a CLI.
- Treat credentials, tokens, authorization headers, and secret-bearing config
  as secrets: never print, return, persist, or include them in errors, debug
  output, or JSON payloads. Keep dependency and configuration objects narrow.

## Commands, flags, and types

- Extend `BaseCommand` and use the type tags that apply:
  `CfgFlags<typeof manifest>`, `Result<T>`, and `Deps<D>`. Type the execution
  context with `ExecCtxOf<this>` and implement `execute({ parsed, deps })`,
  destructuring only what is needed.
- Define flags once with `defineFlags()` and Zod schemas. Use
  `.withPredicate()` for cross-field rules, and register the manifest exactly
  as `static override flags = super.registerManifest(manifest)`.
- Build dependencies in `static buildDeps(parsed)` and keep SDKs, clients,
  filesystems, clocks, and other effects behind the injected `Deps<D>` shape.
  Business logic belongs in `src/lib/`, not in command modules.
- Use shared helper errors and `errorToExitCode`/`handle()` behavior. Throw a
  typed validation or domain error for expected failures; preserve stable error
  codes and exit codes instead of inventing command-local mappings.

## Output contract

- In `--json` mode, stdout contains only the machine-readable JSON result (or
  the shared JSON error shape). Suppress progress, warnings, colors, spinners,
  tables, and every other human log; never mix logs with JSON.
- In human mode, write logs, warnings, progress, and diagnostics to stderr via
  `BaseCommand` helpers. Avoid structured data on stdout unless the command is
  intentionally a plaintext producer.
- Stable TSV or plaintext stdout is allowed only when it is an explicit,
  documented command contract. Gate it correctly in JSON mode and test both
  modes.

## Naming and help

- Prefer singular noun topics (`issue`, `project`) and verb commands (`list`,
  `view`, `create`, `update`, `delete`, `search`). Keep the command tree
  shallow; add a third segment only when it materially improves discovery.
- Use kebab-case long flags and only durable, obvious short aliases. Keep
  `--json`, `--help`/`-h`, and `--version`/`-v` as standard global behavior;
  do not redefine oclif or `BaseCommand` globals.
- Put `summary`, `description`, args, flags, and `examples` on the command.
  Use oclif template variables such as `<%= config.bin %>` and
  `<%= command.id %>` in examples. Show JSON usage and, when applicable, an
  intentional human-readable TSV/plaintext usage.

## Tests

Colocate command and CLI tests under `__tests__/` next to the code. Cover the
behaviors that the command promises:

- oclif parsing and Zod validation, including cross-field predicates;
- JSON gating and JSON result/error shape;
- stdout/stderr separation and suppression of human logs in `--json`;
- shared error handling and stable exit codes; and
- dependency stubbing through `buildDeps()` or the helper package's test
  dependency hooks.

## Current examples

Use current examples, not historical copies:

- [`templates` BaseCommand](https://github.com/charlie-labs/templates/blob/master/cli-oclif/src/cli/commands/base-command.ts)
  shows the approved command boundary.
- [`cquery` flag manifest](https://github.com/charlie-labs/charlie/blob/master/packages/cquery/src/cli/utils/flag-manifest.ts)
  and [typed list command](https://github.com/charlie-labs/charlie/blob/master/packages/cquery/src/cli/commands/enriched-event/list.ts)
  show typed flags and command structure.
- [`creflect` Bun entrypoint](https://github.com/charlie-labs/charlie/blob/master/packages/creflect/bin/run.js)
  and [cross-field validation](https://github.com/charlie-labs/charlie/blob/master/packages/creflect/src/cli/commands/insights/generate.ts)
  show the entrypoint and validation patterns.
- [`ch-slack` command example](https://github.com/charlie-labs/ch-slack/blob/master/src/cli/commands/dm/send.ts),
  [`ch-linear` command example](https://github.com/charlie-labs/ch-linear/blob/master/src/cli/commands/team/list.ts),
  and [`ch-sentry` command example](https://github.com/charlie-labs/ch-sentry/blob/master/src/commands/tags/list.ts)
  show current cross-repository usage.

## Do not copy or expand scope

Do not copy stale direct-oclif implementations, interactive prompts or other
interactive CLI behavior, legacy `apps/cli` patterns, or the placeholder
`clis/system-cli`; they are not the production architecture. This guidance
does not authorize implementing or migrating a CLI, changing
`ch-slack`/`ch-linear`/`ch-sentry`, updating the canonical reference, adding
dependencies, changing workspaces/CI/quality policy, or changing runtime,
prompt, daemon, rule, or customer state.
