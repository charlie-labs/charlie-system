---
name: charlie-slack
description: Use Slack through the ch-slack CLI. Load for Slack channels, threads, messages, replies, users, reactions, or CLI debugging.
---

# Charlie Slack

`ch-slack` is Charlie's agent-facing CLI for Slack. Run it as a command in a
Devbox. It is supplied on `PATH` by
[`charlie-system`](https://github.com/charlie-labs/charlie-system).

## Identity and access

A customer's connected Slack workspace provides Charlie's bot identity and
scoped access. When that integration is available to a Task, the harness
injects its customer-scoped credential into the Devbox as `SLACK_BOT_TOKEN`;
`ch-slack` reads it automatically. Effective access is the intersection of
Task authority, the dynamic Slack capability, integration scopes,
workspace/channel access, and provider permissions.

## Command discovery

The main topics and verbs are:

- Access and lookup: `auth whoami`, `channel` (`list`, `history`), and `thread`
  (`view`).
- Messaging: `message` (`post`, `update`, `delete`) and `dm` (`send`).
- Reactions and files: `react` (`add`, `remove`) and `files` (`upload`).
- Global and common flags: `--json` returns structured JSON, `--limit` bounds
  results when supported, and `--help` is the authority for exact arguments,
  flags, defaults, accepted identifiers, and output shapes.

## Slack mechanics

- Write Slack content in Slack `mrkdwn`; do not substitute formatting rules from
  another provider.
- A message `ts` identifies an exact message. A `thread_ts` identifies the root
  of its reply chain; when there is no separate thread timestamp, the message's
  own `ts` is the root. Target replies at that root, not the latest reply.
- Preserve Slack-native user, channel, and message references instead of
  replacing them with display-name approximations. Use a canonical message
  permalink when a durable pointer is needed.

## Debugging

For Devbox, credential, capability, or Slack-integration questions, consult:

- `ch-docs page /runtime/agent-harness/devboxes`
- `ch-docs page /runtime/external-systems/slack`

For `ch-slack` behavior, inspect the installed version, command help, and the
version-matched source and tests in the Devbox's read-only
`/home/user/.charlie/charlie-system` checkout.

If the observed behavior establishes a `ch-slack` defect rather than a
credential, permission, or usage problem, report it using the bug-reporting
tool available in the current agent tool surface.
