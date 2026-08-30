# Sentry CLI

`ch-sentry` is a Bun and oclif command-line interface for inspecting Sentry
projects, releases, issues, events, and tags. It is the agent-facing Sentry
CLI in this repository and is available through the root `bin/ch-sentry`
executable.

Run the general help or command-specific help with:

```sh
ch-sentry --help
ch-sentry issues list --help
```

## Prerequisites

- A Sentry account with API access
- An auth token with the permissions required by the command

## Configuration

The CLI reads configuration at invocation time. Shell environment variables
take precedence over values in a `.env` file in the current working directory.

- `SENTRY_AUTH_TOKEN` (required): Sentry auth token
- `SENTRY_ORG` (required unless overridden with `--organization`/`-o`): Sentry organization slug
- `SENTRY_REGION` (optional): `us`, `eu`, or `de` (`de` maps to `eu`)
- `SENTRY_API_URL` (optional): explicit API base URL; overrides the region-derived URL

The token is used only for Sentry API requests and is never included in command
output or error payloads.

## Commands

- `projects list` and `projects view`
- `issues list`, `issues view`, and `issues overview`
- `events list` and `events view`
- `releases list`
- `tags list` and `tags values`

Human-readable list commands emit TSV data on stdout and informational
diagnostics on stderr. Add `--json` for a machine-readable result on stdout;
JSON mode suppresses human-readable diagnostics.

Examples:

```sh
ch-sentry projects list
ch-sentry projects view my-project
ch-sentry issues list --project my-project --limit 5
ch-sentry issues view PROJ-123 --project my-project --json
ch-sentry events list PROJ-123 --limit 5
ch-sentry releases list --project my-project
ch-sentry tags values browser --project my-project
```

The root executable also supports raw version output:

```sh
ch-sentry --version
ch-sentry -v
```

## Development

Use the repository root quality commands. The package-local commands are:

```sh
bun run --cwd clis/ch-sentry start --help
bun run --cwd clis/ch-sentry test
```
