---
name: charlie-github
description: Use GitHub through the Devbox-supplied gh CLI. Load for repositories, pull requests, issues, checks, Actions, reviews, comments, reactions, REST or GraphQL API access, links, or CLI debugging.
---

# Charlie GitHub

`gh` is the CLI Charlie uses for GitHub. Run it as a command in a Devbox; the
Devbox supplies the installed version on `PATH`.

## Identity and access

A customer's connected GitHub installation supplies Charlie's app identity and
scoped access. When that integration is available to a Task, the harness
injects its applicable credential as `GH_TOKEN` or `GITHUB_TOKEN`; `gh` reads
these automatically. Effective access is the intersection of current Task
authority, the dynamic GitHub capability, installation permissions, repository
access, and provider protections.

## Command discovery

The main topics and verbs are:

- Repository discovery: `auth status`, `repo` (`clone`, `fork`, `list`, `sync`,
  `view`), and `search` (`code`, `commits`, `issues`, `prs`, `repos`).
- Pull requests: `pr` (`create`, `list`, `view`, `checkout`, `diff`, `checks`,
  `comment`, `review`, `edit`, `ready`, `merge`).
- Issues and Actions: `issue` (`create`, `list`, `view`, `comment`, `edit`,
  `close`, `reopen`), `run` (`list`, `view`, `watch`, `rerun`), and `workflow`
  (`list`, `view`, `run`).
- Global and common flags: `--repo` selects a repository outside the current
  directory; `--json`, `--jq`, and `--template` provide structured output;
  `--limit` bounds results when supported; and `--help` is the authority for
  exact arguments, flags, defaults, accepted identifiers, and output shapes.

## Advanced API access

- Prefer a high-level `gh` topic when it exposes the operation. Use `gh api`
  with a REST endpoint for authenticated resources and operations without one,
  such as reactions. `{owner}`, `{repo}`, and `{branch}` resolve from the
  current repository or `GH_REPO`.
- `gh api` normally sends `GET`, but adding field parameters changes the default
  to `POST`; select the method explicitly when that distinction matters.
- Use `gh api graphql` for authenticated GraphQL queries or mutations when
  precise fields, nested connections, node IDs, or GraphQL-only operations such
  as review-thread resolution make it the better surface. Fields other than
  `query` and `operationName` become GraphQL variables.
- `--paginate` follows REST pagination. GraphQL pagination requires an
  `$endCursor: String` variable and `pageInfo { hasNextPage endCursor }`;
  `--slurp` collects pages. `gh api --help` owns exact request, pagination, and
  output syntax.

## GitHub mechanics

- Pull requests participate in GitHub's issue model. An issue comment is a
  conversation comment on an issue or pull request; an inline review comment
  attaches to its diff; a formal review has an overall state and can group
  review comments. These are distinct surfaces.
- Pull request numbers, formal review IDs, review-comment IDs, REST database
  IDs, and GraphQL node IDs are not interchangeable; preserve the identifiers
  returned for the exact resource and operation.
- Checks and workflow runs describe a commit or ref. Reactions are separate
  resources attached to an exact subject or comment and commonly require
  `gh api`.
- GitHub conversations use GitHub-flavored Markdown and support
  `<details>`/`<summary>`. Issue and pull request references such as `#123` and
  `OWNER/REPO#123` autolink in conversations but not in repository files or
  wikis.

## Debugging

For Devbox, credential, capability, installation, repository-access, or GitHub
integration questions, consult:

- `ch-docs page /runtime/agent-harness/devboxes`
- `ch-docs page /runtime/external-systems/github`

For `gh` behavior, inspect the installed version and relevant command help. For
deeper CLI debugging, use the matching release or tag in the
[`cli/cli`](https://github.com/cli/cli) source and tests.

If the observed behavior establishes a Charlie GitHub integration defect
rather than an upstream CLI, credential, permission, or usage problem, report
it using the bug-reporting tool available in the current agent tool surface.
