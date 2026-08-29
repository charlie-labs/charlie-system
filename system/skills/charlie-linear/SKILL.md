---
name: charlie-linear
description: Use Linear through the ch-linear CLI. Load for Linear issues, projects, comments, reactions, users, workflow state, assignment and delegation, links, context, or CLI debugging.
---

# Charlie Linear

`ch-linear` is Charlie's agent-facing CLI for Linear. Run it as a command in a
Devbox. It is supplied on `PATH` by
[`charlie-system`](https://github.com/charlie-labs/charlie-system).

## Identity and access

A customer's connected Linear workspace provides Charlie's Linear app-user
identity and OAuth access. When that integration is available to a Task, the
harness injects its customer-scoped credential into the Devbox as
`LINEAR_API_KEY` or `LINEAR_ACCESS_TOKEN`; `ch-linear` reads it automatically.
The CLI acts as that connected customer's Charlie app user, not as a human's
personal Linear account.

Effective access is the intersection of:

- the current Task's authority;
- the dynamically supplied Linear capability; and
- the integration's OAuth scopes and workspace permissions.

The CLI and injected credential do not expand those boundaries. Read exact
identity, capability, target, and authorization values from the current prompt
and Task context rather than encoding them in this Skill.

## Command discovery

Use the installed CLI's help as the authority for commands, arguments, flags,
defaults, accepted identifiers, and output shapes:

```text
ch-linear --help
ch-linear <topic> --help
ch-linear <topic> <verb> --help
```

The CLI also provides `ch-linear api graphql` as a raw GraphQL escape hatch for
Linear operations that are not exposed by a higher-level topic. Inspect that
command's help before using it. It uses the same injected identity and access
boundaries as the rest of `ch-linear`.

## Linear mechanics

- Write Linear content in Linear Markdown. Use `>>>` for collapsible sections
  instead of GitHub `<details>` or `<summary>` HTML.
- Use Linear's native `@` references for users, issues, projects, and documents.
  Use a canonical Linear URL or permalink when a durable pointer is needed.
- For a threaded reply, pass the UUID of the parent top-level comment as
  `--parent-id`. Do not pass the latest nested reply; preserve the thread root
  supplied by context or returned by Linear.
- Assignee and delegate are distinct fields. A human assignee and Charlie's app
  delegate can coexist; reading or changing one does not read or change the
  other.
- A Linear team's configured default customer repository is a starting context
  hint, not an allowlist or authorization boundary. Another repository still
  requires the current Task authority and applicable GitHub access.

## Debugging

For Devbox, credential, capability, or Linear-integration questions, consult:

- `ch-docs page /runtime/agent-harness/devboxes`
- `ch-docs page /runtime/external-systems/linear`

For `ch-linear` behavior, inspect the installed version, command help, and the
version-matched source and tests in the Devbox's read-only
`/home/user/.charlie/charlie-system` checkout.

If the observed behavior establishes a `ch-linear` defect rather than a
credential, permission, or usage problem, report it using the bug-reporting
tool available in the current agent tool surface.
