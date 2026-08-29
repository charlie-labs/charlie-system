import { expect, test } from 'bun:test';

import { artifactInput } from '../../__tests__/parse-input.js';
import { parseDaemonArtifact } from '../parse.js';

const daemon = `---
id: release-review
purpose: Review releases.
role: release-manager
watch:
  - A release is opened.
schedule: 0 9 * * 1
routines:
  - Inspect release evidence.
deny: Merge the release.
---
# Release review

Follow the [runbook](../../docs/releases.md).
`;

test('parses Daemon activation, policy, and authored Role reference', () => {
  const compilation = parseDaemonArtifact(
    artifactInput(
      'daemon',
      'customer-wide/.agents/daemons/release-review/DAEMON.md',
      daemon
    )
  );

  expect(compilation.kind).toBe('parsed');
  if (compilation.kind !== 'parsed') return;
  expect(compilation.artifacts[0]).toMatchObject({
    activation: { kind: 'hybrid', schedule: '0 9 * * 1' },
    daemonId: 'release-review',
    deny: ['Merge the release.'],
    kind: 'daemon',
    role: 'release-manager',
  });
  const artifact = compilation.artifacts[0];
  if (artifact?.kind !== 'daemon') return;
  expect(artifact.authoredReferences).toMatchObject([
    { raw: 'release-manager', relationship: 'contributes-to' },
    { raw: '../../docs/releases.md', relationship: 'links-to' },
  ]);
});

test('reports an otherwise valid Daemon with an empty body', () => {
  const compilation = parseDaemonArtifact(
    artifactInput(
      'daemon',
      'customer-wide/.agents/daemons/release-review/DAEMON.md',
      daemon.slice(0, daemon.indexOf('# Release review'))
    )
  );

  expect(compilation.kind).toBe('unparsed');
  expect(compilation.problems.map((problem) => problem.code)).toContain(
    'DAEMON_BODY_REQUIRED'
  );
  expect(
    compilation.problems.find(
      (problem) => problem.code === 'DAEMON_BODY_REQUIRED'
    )?.message
  ).toBe('Daemon requires Markdown instructions');
});

test('keeps a customer Daemon without a Role visible as unparsed', () => {
  const compilation = parseDaemonArtifact(
    artifactInput(
      'daemon',
      'customer-wide/.agents/daemons/release-review/DAEMON.md',
      daemon.replace('role: release-manager\n', '')
    )
  );

  expect(compilation.kind).toBe('unparsed');
  expect(compilation.problems.map((problem) => problem.code)).toContain(
    'DAEMON_FIELD_REQUIRED'
  );
});

test('accepts a core Daemon only when it omits customer Role ownership', () => {
  const compilation = parseDaemonArtifact(
    artifactInput(
      'daemon',
      'core/.agents/daemons/release-review/DAEMON.md',
      daemon.replace('role: release-manager\n', ''),
      { kind: 'core' }
    )
  );

  expect(compilation.kind).toBe('parsed');
  expect(compilation.problems).toEqual([]);
});
