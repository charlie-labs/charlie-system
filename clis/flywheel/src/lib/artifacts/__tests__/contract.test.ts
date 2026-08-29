import { expect, test } from 'bun:test';

import { wholeFileLocation } from '../../repository/location.js';
import type {
  ExternalIdentityTarget,
  SupportResourceTarget,
} from '../../targets/contract.js';
import { targetId } from '../../targets/id.js';
import type {
  ArtifactCompilation,
  ArtifactParseInput,
  ArtifactProblem,
} from '../contract.js';
import {
  artifactExamples,
  documentEntry,
  fixtureSource,
} from './artifact-fixtures.js';

test('artifact boundary values are discriminated plain data', () => {
  const entry = documentEntry();
  const problem: ArtifactProblem = {
    code: 'example',
    message: 'Example problem',
    source: fixtureSource,
  };
  const compilation: ArtifactCompilation = {
    artifacts: artifactExamples(),
    entry,
    kind: 'parsed',
    problems: [problem],
  };
  const input: ArtifactParseInput = {
    bytes: new TextEncoder().encode('# Guide'),
    entry,
  };
  const external: ExternalIdentityTarget = {
    issueId: 'BOT-12915',
    kind: 'linear',
  };

  expect(JSON.parse(JSON.stringify(compilation))).toEqual(compilation);
  expect(wholeFileLocation(entry.path, 'one\ntwo').end).toEqual({
    column: 4,
    line: 2,
  });
  expect(input.bytes).toEqual(new TextEncoder().encode('# Guide'));
  expect([targetId(external), targetId(supportTarget())]).toEqual([
    'linear:BOT-12915',
    'support-resource:customer-wide%2Fdocs%2Fassets%2Fdiagram.png',
  ]);
});

function supportTarget(): SupportResourceTarget {
  return {
    kind: 'support-resource',
    path: 'customer-wide/docs/assets/diagram.png',
  };
}
