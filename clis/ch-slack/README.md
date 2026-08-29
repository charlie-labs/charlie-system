# Slack CLI (`ch-slack`)

Developer‑friendly CLI for your Slack workspace. Post messages, list channels, inspect threads, add/remove reactions, upload files, and more — from your terminal.

## Install and basic usage

Prereqs: Bun 1.x (the CLI uses a Bun shebang).

Clone and run from source:

```bash
git clone https://github.com/charlie-labs/ch-slack.git
cd ch-slack
bun install

# Show top-level help
./bin/run.js --help

# Or run in dev mode (watch-friendly oclif run)
bun run ./bin/dev.js --help
```

Notes on invoking the CLI:

- When running from source, use `./bin/run.js` (or `bun run ./bin/dev.js`).
- If you install the package so it’s on your PATH, the executable name is `ch-slack`.

In all examples below, `ch-slack <command> [args]` is equivalent to `./bin/run.js <command> [args]` when running from a local clone.

## Authentication

Provide a Slack bot token via the `SLACK_BOT_TOKEN` environment variable, or override per‑command with `--token`.

```bash
# Preferred: env var
export SLACK_BOT_TOKEN=xoxb-…

# Override per-call (takes precedence over env var)
ch-slack auth whoami --token xoxb-… --json
```

If neither is set, commands that require auth will exit with an error explaining how to supply a token.

### Required Slack scopes

The bot token must include the following scopes for the CLI features below:

- `chat:write` — post and update messages
- `channels:read`, `groups:read`, `mpim:read`, `im:read` — list channels and open conversation IDs
- `channels:history`, `groups:history`, `im:history`, `mpim:history` — read messages for history/thread views
- `reactions:write`, `reactions:read` — add/remove and inspect reactions
- `files:write` — upload files
- `users:read` — resolve user names and IDs

Optional or situational scopes:

- `users:read.email` — resolve users by email (only needed if you pass emails)
- `channels:join` — allow the bot to join public channels when using `-j` (bots cannot join private channels via API; private channels require an invite)

Optional: add `files:read` only if you need to download or inspect file contents.

Security note: Avoid passing tokens directly on the command line in production, as they can be visible via process lists or end up in shell history. Prefer environment variables (e.g., `export SLACK_BOT_TOKEN=…`) or a secrets manager.

## Global flags and JSON output

- `-h`, `--help` — show help
- `-v`, `--version` — print raw version and exit
- `--json` — emit machine‑readable JSON on stdout and suppress non‑essential logs
- `--token` — Slack bot token to use for this command; overrides `$SLACK_BOT_TOKEN` when both are present (no short alias). See Authentication for recommendations.

JSON mode is safe for piping and uses a precise contract:

- Success: stdout contains `{ "status": "ok", "command": "…", "result": { … } }`; stderr is suppressed; exit code is `0`.
- Error: stdout contains `{ "error": { "type": "…", "message": "…", "exitCode": <number> } }`; stderr is empty; exit code equals the numeric `exitCode` in the payload.

Example (success):

```json
{
  "status": "ok",
  "command": "message.post",
  "result": {
    "channel": "C01234567",
    "ts": "1726519200.000300",
    "threadTs": "1726519200.000300"
  }
}
```

Without `--json`, human‑oriented logs print to stderr and stdout stays quiet unless a command intentionally prints tabular data.

Example error payload:

```json
{
  "error": {
    "type": "Error",
    "message": "Missing Slack token. Pass with --token or set $SLACK_BOT_TOKEN.",
    "exitCode": 1
  }
}
```

## Command reference (concise examples)

All examples below include `--json` so they can be scripted reliably. Replace channel/user references with ones valid in your workspace.

### Auth

```bash
# Who am I?
ch-slack auth whoami --json
```

### Channels

```bash
# List channels (public + private)
ch-slack channel list --types public_channel,private_channel --limit 50 --json

# Fetch recent messages in a channel (optionally bound by oldest/latest)
ch-slack channel history -c general --limit 50 --json
ch-slack channel history -c C0123 --oldest 1726512000.000000 --latest 1726519200.000000 --inclusive --json
```

### Messages

```bash
# Post a message (use `-j` to join first if needed)
ch-slack message post -c general -j -m "Hello" --json
# See `ch-slack message post --help` for `-j` behavior: joins public channels if needed; private channels require an invite.
ch-slack message post -c C0123 --thread 1726519200.000300 -m "Reply" --json

# Update an existing message
ch-slack message update -c general --ts 1726519200.000300 -m "Edited" --json

# Delete a message
ch-slack message delete -c general --ts 1726519200.000300 --json
```

### Reactions

```bash
ch-slack react add -c general --ts 1726519200.000300 -e eyes --json
ch-slack react remove -c general --ts 1726519200.000300 -e eyes --json
```

### Threads

```bash
ch-slack thread view -c general --ts 1726512000.000100 --json
```

### Files

`files upload` uses Slack’s modern external upload flow under the hood (`files.getUploadURLExternal` → upload bytes → `files.completeUploadExternal`). The legacy `files.upload` API is deprecated by Slack and is no longer used by this command.

```bash
# Single channel
ch-slack files upload -c general -f ./notes.txt --title "Notes" --initialComment "here you go" --json

# Multiple channels (repeat -c or pass --channels)
ch-slack files upload -c general -c eng-leads -f ./diagram.png --json
```

## Tips

- Channel and user flags accept flexible references:
  - Channel: ID (`C…`), name (`#general` or `general`), or the ID from a channel URL
  - User: ID (`U…`/`W…`), `@username`, or email
- Use `--limit` to keep outputs small during exploration; increase as needed once scripted.

## E2E tests (optional, live Slack API)

This repo contains an opt‑in end‑to‑end suite that exercises the real Slack API via the CLI. It’s off by default.

Run locally:

```bash
export CH_SLACK_E2E=1
export SLACK_BOT_TOKEN=xoxb-…      # bot token for a dedicated test app/workspace
export SLACK_TEST_CHANNEL_ID=C…     # channel the bot can access (private channel recommended)

bun run test:e2e
```

The suite posts a message, adds a reaction, edits it, views the thread, uploads `README.md`, and deletes the original message.

In CI, workflow `E2E` runs on manual dispatch and on a weekly schedule when the secrets above are configured.
