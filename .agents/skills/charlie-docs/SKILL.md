---
name: charlie-docs
description: Use this to read Charlie's documentation for things like daemons, PR reviews, environment setup and secrets, setup, configuration, and integrations.
---

## How to Read Charlie Docs

The best way to read the Charlie docs is by making `curl` requests to the documentation URLs with `.md` appended to the end. This will return the contents of the page as a Markdown document. For example, `https://docs.charlielabs.ai/daemons/choosing-daemons.md` will return the markdown contents of the Choosing Daemons page.

## Live Docs Index

You can get a list of the current top-level pages in Charlie docs by making a `GET` request to `https://docs.charlielabs.ai/llms.txt`.

You can get the full markdown contents of all documentation pages at once by making a `GET` request to `https://docs.charlielabs.ai/llms-full.txt`.

## Primary Docs Pages

These are the primary pages that are most useful to read and have stable URLs (so you can make direct requests without checking the live index first):

- [Installation](https://docs.charlielabs.ai/installation.md): Set up Charlie with GitHub, then connect optional integrations.
- [Daemons](https://docs.charlielabs.ai/daemons.md): Understand what Charlie daemons are, how they wake, and how DAEMON.md controls behavior.
- [Choosing daemons](https://docs.charlielabs.ai/daemons/choosing-daemons.md): Choose the right daemon roles using practical selection heuristics, scoping rules, and rollout fit.
- [Writing and editing DAEMON.md](https://docs.charlielabs.ai/daemons/writing-and-editing-daemon-md.md): Create and improve DAEMON.md files that are narrow, explicit, and safe to run repeatedly.
- [Review Checklist](https://docs.charlielabs.ai/daemons/review-checklist.md): Review daemon-file pull requests for contract, safety, repeatability, and proof gaps before merge.
- [Testing and iterating on daemons](https://docs.charlielabs.ai/daemons/testing-and-iterating-on-daemons.md): Roll out daemons safely, reduce blast radius, and iterate based on observed behavior.
- [DAEMON.md reference](https://docs.charlielabs.ai/daemons/daemon-md-reference.md): Exact DAEMON.md authored contract, validation rules, and support-tree semantics.
- [Daemon-powered PR reviews](https://docs.charlielabs.ai/pr-reviews.md): Define your PR review system. Charlie runs it.
- [Setup](https://docs.charlielabs.ai/pr-reviews/setup.md): Install the `pr-review` daemon and confirm your first PR review.
- [Configure](https://docs.charlielabs.ai/pr-reviews/configure.md): Change when Charlie reviews, what he looks for, and how he publishes feedback.
- [AGENTS.md instructions](https://docs.charlielabs.ai/AGENTS.md-instructions.md): Design concise, scoped runtime instructions that improve agent decisions and discovery.
- [Environment setup](https://docs.charlielabs.ai/environment-setup.md): Prepare Charlie devboxes for repo-specific dependencies and system packages.
- [Skills](https://docs.charlielabs.ai/skills.md): Define reusable task-shaped playbooks and invoke them on demand.
- [FAQ](https://docs.charlielabs.ai/faq.md): Common questions about Charlie, including daemon behavior.
- [Integrations](https://docs.charlielabs.ai/integrations/index.md): Connect Charlie directly to tools or provide environment variables via the dashboard.
- [GitHub Integration](https://docs.charlielabs.ai/integrations/github.md): Connect Charlie to GitHub.
- [GitHub App and User](https://docs.charlielabs.ai/integrations/github-identities.md): Understand the difference between CharlieCreates and CharlieHelps on GitHub.
- [Linear Integration](https://docs.charlielabs.ai/integrations/linear.md): Connect Charlie to Linear.
- [Slack Integration](https://docs.charlielabs.ai/integrations/slack.md): Connect Charlie to Slack.
- [Sentry Integration](https://docs.charlielabs.ai/integrations/sentry.md): Connect Charlie to Sentry.

## Related Resources

The following resources are related to Charlie and may be helpful to you:

- [Website](https://charlielabs.ai/): The official Charlie website.
- [Changelog](https://docs.charlielabs.ai/changelog): The Charlie product changelog.
- [Daemon examples](https://github.com/charlie-labs/daemons): A collection of example Daemons for common use cases.
- [Customer dashboard](https://app.charlie.dev/): The Charlie customer dashboard used for viewing Charlie's activity and usage, setup, configuration, managing integrations and secrets, and billing.
