---
name: charlie-github
description: Use GitHub through the Devbox-supplied gh CLI. Load for GitHub repositories, pull requests, issues, checks, reviews, comments, reactions, links, or CLI debugging.
---

# Charlie GitHub

`gh` is Charlie's agent-facing CLI for GitHub. Run it in a Devbox; the
Devbox-supplied version and connected provider credentials are the operation
surface. Use it for repository, pull request, issue, check, review, comment,
and reaction work. This Skill captures cross-command GitHub mechanics, not a
command catalog.

## Identity and access

A customer's connected GitHub installation supplies Charlie's app identity and
scoped access. When that integration is available to a Task, the harness
injects its applicable credential as `GH_TOKEN` or `GITHUB_TOKEN`; `gh` reads
these automatically. Effective access is the intersection of current Task
authority, the dynamic GitHub capability, installation permissions, repository
access, and provider protections. Exact identities, repositories, refs,
issues, pull requests, comments, reviews, SHAs, and authorizations come from
the current Task and provider context, not from this Skill.

## Command discovery and operation scope

Use the relevant high-level `gh` topic when it exposes the needed operation.
Installed `gh --help` and the relevant subcommand help are the syntax
authority for commands, arguments, flags, pagination, JSON/output shapes,
multiline body handling, and exact behavior; do not rely on a different `gh`
version's remembered interface.

Use `gh api` as the escape hatch for a GitHub operation not exposed by a
higher-level topic, including `gh api graphql` when the GraphQL API is the
appropriate surface. This is also the general low-level surface for provider
resources such as reactions that do not have a dedicated high-level command.

## GitHub resource model and targets

GitHub's issue model includes pull requests: issue-oriented operations such as
issue comments can target a pull request, but they do not create a pull
request review.

- An issue comment is a conversation comment on an issue or pull request.
- A pull request review comment is attached to a file or line in the pull
  request's unified diff. It is distinct from an issue comment.
- A formal pull request review is a review record with an overall state and
  optional body; it can group review comments and is distinct from either
  comment surface.
- Checks are CI/status results associated with a commit or ref and surfaced
  for pull request work; they are not reviews or comments.
- Reactions are separate resources attached to a supported GitHub target or
  comment; they do not edit the target's body or review state.

Match the identifier to the resource being addressed: a repository target uses
its owner/repository context, an issue or pull request uses its number or URL,
and a comment or review uses that object's returned identifier. A review
comment ID is not interchangeable with its containing pull request number or
formal review ID. Preserve the containing pull request target and the specific
comment target when working with an inline review thread; exact line,
position, reply, and payload fields belong to installed `gh` help and the
GitHub API documentation.

## GitHub formatting and links

GitHub conversations render GitHub-flavored Markdown. In those conversations,
GitHub automatically links URLs, issue and pull request references such as
`#123` or `OWNER/REPO#123`, and commit SHAs; the same issue/PR autolinking does
not apply to repository files or wikis. GitHub also supports collapsed sections
with `<details>` and `<summary>`. Prefer a canonical GitHub URL when the
repository or target is ambiguous or when a durable cross-surface link is
needed.

## Debugging

For Devbox, credential, capability, installation, repository-access, or GitHub
integration questions, consult:

- `ch-docs page /runtime/agent-harness/devboxes`
- `ch-docs page /runtime/external-systems/github`

For exact `gh` behavior, inspect the installed `gh --version` and relevant
`gh --help` output in the Devbox; the version-matched binary and its help are
the authority. If observed behavior establishes a Charlie GitHub integration
defect rather than an access or usage problem, report it using the available
bug-reporting path.
