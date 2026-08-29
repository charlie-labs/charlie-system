---
name: charlie-sentry
description: Use Sentry through ch-sentry for issue, event, trace, error, and diagnostic investigations, including access boundaries, evidence interpretation, and CLI troubleshooting.
---

# Charlie Sentry

`ch-sentry` is Charlie's agent-facing CLI for Sentry. Run it in a Devbox; the
installed executable is supplied by
[`charlie-system`](https://github.com/charlie-labs/charlie-system).

## Identity and access

A connected customer's Sentry integration supplies `SENTRY_AUTH_TOKEN` and
`SENTRY_ORG` to eligible Task Devboxes, where `ch-sentry` reads them from the
environment. The CLI acts with the connected customer's Sentry identity, not
with a human's personal account.

Effective access is the intersection of Task authority, the dynamically
supplied Sentry capability, token scopes, organization and project access, and
provider permissions. Injected credentials provide access material; they do
not grant authority or prove that a requested project or resource is readable.

Sentry is an evidence source, not a work source: Sentry activity does not start
or continue a Task. Use the originating GitHub, Linear, Slack, or scheduled
Role context for the work, and use Sentry's current operational evidence within
that authority. The integration is read-only.

## Evidence model

An issue groups related occurrences, while an event is one concrete occurrence.
Trace and span data can connect an event to request execution; transaction,
release, and environment context help qualify the affected code path and
deployment scope. A grouped issue can span releases or environments, and its
latest event is not necessarily the event that prompted the work.

For error or diagnostic work, establish the relevant issue or event first, then
interpret any available trace, release, environment, or transaction context in
that same project scope. Keep exact identifiers and live values task-specific;
this Skill does not define query dimensions or result schemas.

## Command discovery

Start with installed `ch-sentry --help`, then read the relevant subcommand help
when the operation or input shape is unclear. Installed help is the authority
for commands, flags, filters, accepted identifiers, query dimensions,
pagination, output schemas, and exact command behavior. Do not infer those
details from this Skill or from an older invocation.

## Debugging

For Devbox, credential, capability, or Sentry-integration behavior, consult:

- `ch-docs page /runtime/agent-harness/devboxes`
- `ch-docs page /runtime/external-systems/sentry`

For exact `ch-sentry` behavior, inspect the installed version, command help,
and the version-matched source and tests in the Devbox's read-only
`/home/user/.charlie/charlie-system` checkout. If those sources establish a
CLI defect rather than an access or usage problem, report it with the
bug-reporting tool available in the current agent tool surface.
