# Public authoring guide

This guide describes the intentionally small public layout. It is guidance
for maintainers, not a request to seed the repository with speculative skills
or rules.

## Skills

Create a directory at `.agents/skills/<skill-name>/` with a required
`SKILL.md` file. The file starts with simple YAML front matter:

```markdown
---
name: example-skill
description: A concise public description of the skill.
---

# Example skill
```

The `name` must be lowercase kebab-case and must match the directory name.
Descriptions must be non-empty. A skill may contain `references/` and
`scripts/` subdirectories. Relative Markdown links must resolve to files in
the repository; external links are allowed when they are intentional public
references.

## Rules

Place general public rules in `.agents/rules/` as Markdown files. Rules should
be scoped to general Charlie behavior and must not contain customer-specific
or internal material. Rule names are checked for duplicates but duplicate
names are not runtime errors.

## Resources and scripts

General public resources belong in `.agents/resources/`. Supporting scripts
belong in `scripts/` or in a skill's `scripts/` directory. Scripts must be
deterministic, have no embedded credentials, and avoid mutating external
systems during validation.

## References

Use relative links for repository-owned references. Keep external links
public and stable. The repository validator checks relative Markdown links and
fails when a referenced file is missing.

## Validation expectations

Run:

```sh
npm test
npm run validate
```

The validator checks metadata, references, path/layout constraints, scripts,
duplicate names, license and policy files, workflow permissions, and common
secret patterns.
