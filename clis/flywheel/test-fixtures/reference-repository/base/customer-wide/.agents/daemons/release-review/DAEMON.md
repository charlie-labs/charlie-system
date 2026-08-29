---
id: release-review
purpose: Review customer releases.
role: release-manager
watch:
  - A release changes.
schedule: 0 9 * * 1
routines:
  - Inspect release evidence.
deny: Merge the release.
---

# Release review

Review each release before deployment.

Follow the [checklist](./CHECKLIST.md).
