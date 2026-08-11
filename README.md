# Charlie system

`charlie-system` is the public home for intentionally public Charlie skills,
rules, and supporting authoring resources.

## Public-content boundary

This repository is public by design. It must contain only general-purpose
system content that is suitable for public review. Do not add:

- customer data or customer-specific instructions;
- Charlie Labs internal knowledge, incidents, or evaluations;
- credentials, private endpoints, or customer-derived prompts; or
- any other material that has not been intentionally reviewed for publication.

Runtime Charlie access is anonymous and read-only. There is no Cloudflare
mirror and no runtime GitHub credential path for this repository.

## Layout

```text
.
├── .agents/
│   ├── resources/       # General public resources
│   ├── rules/           # General public rules
│   └── skills/          # Skill directories containing SKILL.md
├── docs/                # Public authoring and runtime documentation
├── scripts/             # Repository validation and tests
├── CONTRIBUTING.md
├── LICENSE
└── package.json
```

The layout is deliberately small. Add content only when it has a concrete
public consumer and document the contract in `docs/authoring.md` when needed.

## Validation

This repository has no third-party runtime dependencies. Run the same checks
used by CI locally:

```sh
npm test
npm run validate
```

Validation checks skill metadata and relative references, rule and script
layout, duplicate skill/rule names, public-path constraints, required license
and runtime-policy files, workflow permissions, and common secret patterns.
Duplicate names are reported as warnings rather than execution errors; runtime
discovery must remain non-throwing when names collide.

## Changes

Changes are made through pull requests and require human maintainer approval.
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the public-content review policy.
