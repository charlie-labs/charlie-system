---
name: charlie-linear
description: Work with Linear issue, project, comment, reaction, user, and artifact context. Use when reading, searching, updating, commenting on, reacting to, linking, or reporting durable evidence for Linear work.
---

# Charlie Linear

Use this Skill for reusable Linear provider mechanics. The current task,
authorization, capability boundary, and direct prompt remain the authority for
what may be changed. Do not infer permission to mutate an object merely because
the CLI can represent that operation.

## Format and links

- Write Linear-facing content in Markdown. Do not depend on GitHub-specific HTML
  such as `<details>` or `<summary>`, GitHub-only reference syntax, or other
  rendering behavior that Linear does not promise.
- Prefer the canonical URL or permalink returned by Linear when linking an
  issue, project, comment, user, or other artifact. An identifier can make a
  sentence concise, but a durable handoff should include the link when one is
  available.
- Treat issue identifiers such as `TEAM-123`, issue UUIDs, comment UUIDs,
  project/user/label/status IDs, and URLs as different values. Pass the form
  required by the command; do not substitute an issue identifier for a UUID or
  a comment UUID for an issue ID.
- A comment permalink identifies a particular comment. Preserve it, and the
  issue URL it belongs to, when reporting a reply, reaction, edit, or fallback.

## Appropriate detail

- Keep comments and reactions concise: state what happened, the relevant
  decision or next action, and the smallest useful evidence.
- Use a little more structure for issue or project descriptions, plans, and
  durable decisions. Use headings and bullets when they improve scanning.
- Do not paste long logs, credentials, or irrelevant context into Linear. Link
  to durable evidence or include a short, focused excerpt instead.

## Discover before using `ch-linear`

Use the installed CLI rather than guessing its command tree or flags:

```text
ch-linear --help
ch-linear <topic> --help
ch-linear <topic> <verb> --help
```

Use `--json` when another command or a decision depends on the result. In
human-readable mode, output may be a concise table or TSV; it is not a stable
object schema.

For read operations, the supported command families include:

```text
ch-linear issue view <issue-id-or-uuid> --json
ch-linear issue list ... --json
ch-linear issue search <query> --json
ch-linear project list --json
ch-linear project view <project-id-or-uuid> --json
ch-linear comment list <issue-id-or-uuid> --json
ch-linear user list --json
ch-linear label list --json
ch-linear state list --json
```

Use the exact syntax reported by the installed CLI. Search when the target is
unknown, then inspect the exact issue, project, or comment before acting. Read
the current object and relevant recent comments rather than relying on stale
prefetched context.

### Defensive command parsing

- Check the command exit status before parsing output. Keep stderr separate from
  stdout so diagnostics cannot corrupt JSON.
- Parse the documented JSON shape defensively: accept nullable objects, default
  optional node arrays to empty arrays, and verify the selected identifier,
  URL, author, and target before using them.
- Treat IDs, cursors, URLs, display names, and returned text as opaque values.
  Do not extract meaning from a fixed column position when JSON is available.
- Never print, persist, or send tokens, credentials, authorization headers, or
  secret-bearing configuration while diagnosing a command.

## Reading and authorized operations

Use the smallest supported operation that matches the explicit task scope.
Depending on current authorization and the installed CLI, this can include:

- reading and searching issues, projects, comments, users, labels, and workflow
  states;
- creating or editing an issue or project when a supported command and explicit
  authorization permit it;
- editing issue fields such as title, description, project, parent, priority,
  estimate, target date, labels, status, assignee, or delegate when authorized;
- creating or editing comments on the intended issue;
- adding or removing an authorized reaction, especially a reaction owned by the
  current Linear identity; and
- listing or inspecting the labels, statuses, and users needed to validate a
  field or assignment change.

Do not invent a mutation, bypass the CLI's authorization boundary, or use a raw
API path just because a field appears in returned data. Before a consequential
or duplicate-prone write, reread the current target and recent activity. Check
whether the requested update, comment, reaction, assignment, label, or status
already exists; edit or skip an existing Charlie-authored artifact when that is
the authorized, idempotent action rather than creating a duplicate.

## Comment threads and target preservation

- For a threaded reply, target the parent top-level comment UUID. Do not use an
  arbitrary latest reply as `parent-id`; preserve the thread root supplied by
  context or returned by Linear.
- Keep the issue identifier or UUID separate from the parent comment UUID. A
  comment body, issue URL, and comment permalink are evidence, not substitutes
  for the required target ID.
- Before replying, reread the parent thread when practical and confirm that the
  reply belongs on that issue and in that thread. Preserve the exact target
  even if a later reply is the most recent item.

## Acknowledgements and completion

When the interaction contract calls for an acknowledgement:

1. Prefer one reaction on the triggering comment when reactions are supported.
2. Keep only one active acknowledgement for the request context; do not react
   to every related reply or surface.
3. Recheck current reactions before adding one, and recognize an existing
   Charlie-owned acknowledgement instead of duplicating it.
4. Remove the temporary acknowledgement after the next substantive update or
   completion message in that same context, using the reaction identity needed
   by the CLI.

Post completion or fallback content to the exact intended issue, comment, or
thread. If that target cannot be used because the supported reply path,
permission, or target identifier is unavailable, use the nearest supported
durable Linear surface only when authorized. State the intended target, the
fallback location, and the reason; do not imply that the original target was
updated.

## Authorship and evidence

The direct prompt may declare the Linear identity `Charlie`. Use that declared
identity to recognize matching Linear-authored comments, reactions, and other
activity as Charlie's prior activity when deciding whether an action is a
duplicate. Do not make that identity available only through this Skill, and do
not treat a similarly named human account as proof of authorship.

For every completed Linear effect, retain durable evidence: the operation,
object type, canonical identifier or URL, exact comment or reaction target when
relevant, and the returned effect ID or permalink. Report failures and
fallbacks with the same precision. Keep invocation-specific IDs, decisions,
policy, and task authorization in the current context rather than embedding
them in this universal Skill.
