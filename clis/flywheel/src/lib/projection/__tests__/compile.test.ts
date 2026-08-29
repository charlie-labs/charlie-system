import { expect, test } from 'bun:test';

import { sortedCopy } from '../../repository/ordering.js';
import { targetId } from '../../targets/id.js';
import { compileRepository } from '../compile.js';
import { projectionSource } from './repository-fixture.js';

test('composes one discovery and one artifact batch read into a plain projection', async () => {
  const fixture = projectionSource();

  const projection = await compileRepository(fixture.source);

  expect(fixture.observation.listCalls).toBe(1);
  expect(fixture.observation.readCalls).toBe(1);
  expect(fixture.observation.readPaths[0]).not.toContain(
    'customer-wide/docs/assets/diagram.png'
  );
  expect(projection.compilations).toHaveLength(7);
  expect(
    projection.compilations.find(
      (compilation) => compilation.entry.path === 'customer-wide/docs/broken.md'
    )?.kind
  ).toBe('unparsed');
  expect(projection.resolutions).toHaveLength(10);
  expect(
    projection.resolutions.every((resolution) => resolution.kind === 'resolved')
  ).toBe(true);
  expect(
    projection.graph.targets.some(
      (record) => record.target.kind === 'source-repository-file'
    )
  ).toBe(false);
  expect(projection.graph.targets.map((record) => record.id)).toContain(
    'linear:BOT-42'
  );
  expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
});

test('produces deterministic projection arrays for identical source state', async () => {
  const [left, right] = await Promise.all([
    compileRepository(projectionSource().source),
    compileRepository(projectionSource().source),
  ]);

  expect(left).toEqual(right);
  expect(left.graph.targets.map((record) => record.id)).toEqual([
    ...sortedCopy(
      left.graph.targets.map((record) => targetId(record.target)),
      (first, second) => first.localeCompare(second)
    ),
  ]);
});
