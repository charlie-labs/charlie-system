import { expect, test } from 'bun:test';

import { catalogTarget, roleTarget, targetId } from '../id.js';
import { buildTargetLookupIndex, lookupTarget } from '../lookup.js';

test('builds deterministic target and alias lookups without duplicate targets', () => {
  const role = roleTarget('reviewer');
  const component = catalogTarget({
    entityKind: 'Component',
    name: 'reviewer',
  });
  const index = buildTargetLookupIndex([
    { aliases: ['reviewer'], target: role },
    { aliases: ['reviewer'], target: component },
    { aliases: ['reviewer'], target: role },
  ]);

  expect(index.byId.get(targetId(role))).toEqual(role);
  expect(lookupTarget(index, 'reviewer')).toEqual({
    candidates: [component, role],
    input: 'reviewer',
    kind: 'ambiguous',
  });
  expect(
    lookupTarget(index, 'reviewer', (target) => target.kind === 'role')
  ).toEqual({ input: 'reviewer', kind: 'found', target: role });
});

test('keeps an unknown alias explicit', () => {
  const index = buildTargetLookupIndex([]);

  expect(lookupTarget(index, 'missing')).toEqual({
    input: 'missing',
    kind: 'missing',
  });
});
