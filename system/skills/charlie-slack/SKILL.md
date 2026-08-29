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
workspace/channel access, and provider permissions. Exact workspace, channel,
message, user, target, and authorization values are invocation-specific and
remain in current context.

## Command discovery

Use installed `ch-slack --help` as the authority for commands, arguments,
flags, accepted identifiers, output schemas, and exact behavior across channel,
thread, message, reply, user, and reaction work.

## Slack mechanics

- Write Slack content in Slack `mrkdwn`; do not substitute formatting rules from
  another provider.
- A message `ts` identifies an exact message. A `thread_ts` identifies the
  root of its reply chain; when there is no separate thread timestamp, the
  message's own `ts` is the root.
- Replies must target the thread root, not the latest nested reply. Preserve the
  channel and root `thread_ts` supplied by context or returned by Slack.
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
