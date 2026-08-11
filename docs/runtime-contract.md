# Runtime contract

The system repository is a standalone public GitHub repository whose default
branch is `master`.

Runtime access is intentionally anonymous and read-only:

- clone directly from GitHub without an authorization header;
- there is no runtime GitHub credential; and
- there is no Cloudflare mirror or another runtime store.

Repository changes use the authenticated maintainer workflow described in
[`CONTRIBUTING.md`](../CONTRIBUTING.md), not a runtime write path. The public
repository remains separate from customer knowledge and Charlie Labs internal
material.
