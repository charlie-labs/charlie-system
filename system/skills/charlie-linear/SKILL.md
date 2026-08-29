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
personal Linear account. Effective access is the intersection of Task
authority, the dynamic Linear capability, and the integration's OAuth scopes
and workspace permissions.

## Command discovery

The main topics and verbs are:

- Issues and comments: `issue` (`create`, `edit`, `list`, `search`, `view`),
  `comment` (`create`, `list`, `update`), and `comment reaction` (`add`,
  `remove`).
- Planning and content: `project` (`list`, `view`), `project-update` (`create`,
  `edit`, `list`, `view`, `archive`), `initiative` (`create`, `edit`/`update`,
  `list`, `view`), and `document` (`create`, `edit`, `search`, `view`).
- Workspace lookup: `workspace` (`overview`) and `team`, `user`, `label`, and
  `state` (`list`).
- Customers: `customer` and `customer-need` (`create`, `list`).
- Low-level access: `api graphql` runs raw Linear GraphQL when no higher-level
  topic exposes the needed operation.
- Global flags: `--json` returns raw JSON, `--limit` bounds results when
  supported, and `--help` is the authority for exact arguments, flags, defaults,
  accepted identifiers, and output shapes.

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
