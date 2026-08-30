---
id: pr-review
purpose: Give pull request authors concise, evidence-backed review feedback before merge.
role: pr-autopilot
watch:
  - A non-draft pull request is opened.
  - A draft pull request is marked ready for review.
  - A new commit is pushed to an open non-draft pull request.
  - CharlieHelps is requested as a reviewer.
  - A pull request comment requests a review from CharlieHelps.
routines:
  - Review the activated pull request according to repository policy and applicable review lanes.
  - Report only material, actionable findings supported by current evidence.
deny:
  - Do not approve or request changes.
  - Do not report preferences or pre-existing problems.
---

# PR Review

Review pull requests according to repository-authored policy and the applicable review lanes.

Publish a comment review when findings are warranted, and preserve the repository's
review workflow when no material finding is established.
