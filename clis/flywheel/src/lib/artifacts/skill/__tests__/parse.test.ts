import { expect, test } from 'bun:test';

import { artifactInput } from '../../__tests__/parse-input.js';
import { parseSkillArtifact } from '../parse.js';

const skill = `---
name: release-review
description: Review a release when release evidence is available.
license: MIT
compatibility: Requires GitHub access.
metadata:
  owner: platform
allowed-tools: Bash Read
---
# Review a release

Read the [release guide](../../../docs/releases.md).
`;

test('parses the Agent Skills contract without exposing Markdown syntax', () => {
  const compilation = parseSkillArtifact(
    artifactInput(
      'skill',
      'customer-wide/.agents/skills/release-review/SKILL.md',
      skill
    )
  );

  expect(compilation.kind).toBe('parsed');
  if (compilation.kind !== 'parsed') return;
  expect(compilation.artifacts[0]).toMatchObject({
    allowedTools: 'Bash Read',
    compatibility: 'Requires GitHub access.',
    description: 'Review a release when release evidence is available.',
    kind: 'skill',
    license: 'MIT',
    metadata: { owner: 'platform' },
    name: 'release-review',
  });
  const artifact = compilation.artifacts[0];
  if (artifact?.kind !== 'skill') return;
  expect(artifact.authoredReferences).toMatchObject([
    { raw: '../../../docs/releases.md', relationship: 'links-to' },
  ]);
  expect('type' in artifact).toBe(false);
});

test('reports each present malformed optional Skill field', () => {
  const compilation = parseSkillArtifact(
    artifactInput(
      'skill',
      'customer-wide/.agents/skills/release-review/SKILL.md',
      skill
        .replace('license: MIT', 'license: ""')
        .replace(
          'compatibility: Requires GitHub access.',
          'compatibility: [GitHub]'
        )
        .replace('allowed-tools: Bash Read', 'allowed-tools:\n  Bash: true')
    )
  );

  expect(compilation.kind).toBe('parsed');
  expect(
    compilation.problems.map((problem) => [problem.code, problem.message])
  ).toEqual([
    ['SKILL_FIELD_INVALID', 'Skill allowed-tools must be a non-empty string'],
    ['SKILL_FIELD_INVALID', 'Skill compatibility must be a non-empty string'],
    ['SKILL_FIELD_INVALID', 'Skill license must be a non-empty string'],
  ]);
});

test('retains a Skill with missing required metadata as unparsed', () => {
  const compilation = parseSkillArtifact(
    artifactInput(
      'skill',
      'customer-wide/.agents/skills/release-review/SKILL.md',
      skill.replace(
        'description: Review a release when release evidence is available.\n',
        ''
      )
    )
  );

  expect(compilation.kind).toBe('unparsed');
  expect(compilation.problems.map((problem) => problem.code)).toContain(
    'SKILL_FIELD_REQUIRED'
  );
});
