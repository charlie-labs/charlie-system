import { expect, test } from 'bun:test';

import { artifactInput } from '../../__tests__/parse-input.js';
import { parseRoleArtifact } from '../parse.js';

test('parses the strict Role contract', () => {
  const compilation = parseRoleArtifact(
    artifactInput(
      'role',
      'roles/release-manager.yaml',
      'schemaVersion: role.v0\nid: release-manager\nobjective: Keep releases dependable.\n',
      { kind: 'roles' }
    )
  );

  expect(compilation).toMatchObject({
    artifacts: [
      {
        kind: 'role',
        objective: 'Keep releases dependable.',
        roleId: 'release-manager',
        schemaVersion: 'role.v0',
      },
    ],
    kind: 'parsed',
    problems: [],
  });
});

test('does not interpret an unsupported Role schema as a parsed Role', () => {
  const compilation = parseRoleArtifact(
    artifactInput(
      'role',
      'roles/release-manager.yaml',
      'schemaVersion: role.v9\nid: release-manager\nobjective: Release safely.\n',
      { kind: 'roles' }
    )
  );

  expect(compilation.kind).toBe('unparsed');
  expect(compilation.problems.map((problem) => problem.code)).toContain(
    'ROLE_SCHEMA_UNSUPPORTED'
  );
});
