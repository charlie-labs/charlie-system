# Contributing to `charlie-system`

Thank you for helping improve the public Charlie system repository.

## Required workflow

1. Create a branch from `master`.
2. Keep the change limited to intentionally public system content.
3. Run `npm test` and `npm run validate`.
4. Open a pull request with a clear description of the public consumer and
   validation results.
5. Wait for required CI checks and human maintainer approval before merge.

Direct pushes and force pushes to `master` are not part of the contribution
policy. Repository settings should enforce this policy; if settings are not
available to the person preparing a change, record that as an administrative
blocker rather than bypassing review.

## Public-content review

Before opening a pull request, verify that the diff contains no:

- customer data or customer-specific instructions;
- internal knowledge, private endpoints, incidents, or evaluations;
- credentials, tokens, secrets, or authorization headers; or
- customer-derived source, prompts, or other private material.

Do not add runtime write paths, a repository mirror, or credentials for
anonymous runtime checkout. Runtime consumers must continue to clone this
public repository without authentication and use it read-only.

## Skills, rules, and resources

Follow [`docs/authoring.md`](docs/authoring.md). Keep references relative and
keep scripts deterministic and safe to run in CI. Duplicate names are allowed
by the runtime contract; the validator reports them so maintainers can review
precedence without making discovery throw.

## License

Contributions are published under the [MIT License](LICENSE).
