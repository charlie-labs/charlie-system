import { expect, test } from 'bun:test';

import { sourceLocation } from '../../../repository/location.js';
import type { SourceFragment } from '../contract.js';
import { renderFragments } from '../render.js';

test('preserves authored GFM table alignment in rendered output', () => {
  const source = sourceLocation('customer-wide/docs/table.md', {
    column: 1,
    line: 1,
  });
  const table: SourceFragment = {
    alignment: ['left', 'center', 'right', null],
    citationKeys: [],
    kind: 'table',
    rows: [
      ['Left', 'Center', 'Right', 'Unaligned', 'Missing'],
      ['a|b', 'c', 'd', 'e', 'f'],
    ],
    source,
  };

  expect(renderFragments([table])).toBe(
    '| Left | Center | Right | Unaligned | Missing |\n' +
      '| :-- | :-: | --: | --- | --- |\n' +
      '| a\\|b | c | d | e | f |'
  );
});
