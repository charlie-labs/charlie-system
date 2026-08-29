---
purpose: Explain customer-wide release operations.
reviewEvery: 90d
about:
  - component:default/api
---

# Release guide

Release operations use the platform API. See the [runbook](./assets/release-runbook.txt) and [diagram](./assets/release-diagram.png).[^release]

## Procedure

1. Prepare the release.
2. Deploy the release.

```sh
bun run release:check
```

| Stage   | Owner    |
| ------- | -------- |
| Prepare | Platform |
| Deploy  | Operator |

> Stop if release evidence is missing.

[^release]: [Implementation](https://github.com/charlie-labs/charlie-system/pull/42)
