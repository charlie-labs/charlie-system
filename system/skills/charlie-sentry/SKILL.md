---
name: charlie-sentry
description: Use Sentry through the ch-sentry CLI. Load for Sentry projects, issues, events, traces, releases, tags, errors, diagnostics, or CLI debugging.
---

# Charlie Sentry

`ch-sentry` is Charlie's agent-facing CLI for Sentry. Run it as a command in a
Devbox. It is supplied on `PATH` by
[`charlie-system`](https://github.com/charlie-labs/charlie-system).

## Identity and access

A customer's connected Sentry organization supplies the available
`SENTRY_AUTH_TOKEN` and `SENTRY_ORG`. When that integration is available to a
Task, the harness injects them into the Devbox and `ch-sentry` reads them
automatically. The Sentry user behind the injected auth token determines the
provider-visible identity and token permissions. Effective access is the
intersection of Task authority, the dynamic Sentry capability, token scopes,
organization and project access, and provider permissions.

## Command discovery

The main topics and verbs are:

- Projects: `projects` (`list`, `view`).
- Issues and events: `issues` (`list`, `view`) and `events` (`list`, `view`).
- Releases and tags: `releases` (`list`) and `tags` (`list`, `values`).
- Global flags: `--json` returns JSON, and `--help` is the authority for exact
  arguments, flags, filters, defaults, accepted identifiers, pagination, and
  output shapes.

## Sentry mechanics

- An issue groups related events; an event is one concrete occurrence. A
  grouped issue can span releases or environments, and its latest event is not
  necessarily the occurrence relevant to the current Task.
- A trace contains connected spans and errors across request execution.
  Transaction, release, and environment context qualify the affected code path
  and deployment scope.

## Debugging

For Devbox, credential, capability, or Sentry-integration behavior, consult:

- `ch-docs page /runtime/agent-harness/devboxes`
- `ch-docs page /runtime/external-systems/sentry`

For `ch-sentry` behavior, inspect the installed version, command help, and the
version-matched source and tests in the Devbox's read-only
`/home/user/.charlie/charlie-system` checkout.

If the observed behavior establishes a `ch-sentry` defect rather than a
credential, permission, or usage problem, report it using the bug-reporting
tool available in the current agent tool surface.
