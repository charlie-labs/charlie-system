import { expect, test } from 'bun:test';

import { resolveStateId, resolveWorkflowStateIds } from '../state.js';

type State = {
  id: string;
  name: string;
  type?: string;
  position?: number | null;
  team?: { id: string; name?: string } | null;
};

const TEAM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEAM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEAM_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const STATES: State[] = [
  { id: 'done-a', name: 'Done', team: { id: TEAM_A } },
  { id: 'done-b', name: 'Done', team: { id: TEAM_B } },
  { id: 'todo-a', name: 'Todo', team: { id: TEAM_A } },
  { id: 'inprog-c', name: 'In Progress', team: { id: TEAM_C } },
];

test('resolveWorkflowStateIds aggregates across all teams by default', async () => {
  const ids = await resolveWorkflowStateIds(
    ['Done'],
    {},
    {
      getStates: async () => STATES as any,
    }
  );
  expect(ids).toEqual(['done-a', 'done-b']);
});

test('resolveWorkflowStateIds filters by a single team when provided', async () => {
  const ids = await resolveWorkflowStateIds(
    ['Done'],
    { teamIds: [TEAM_A] },
    {
      getStates: async () => STATES as any,
    }
  );
  expect(ids).toEqual(['done-a']);
});

test('resolveWorkflowStateIds filters by multiple teams', async () => {
  const ids = await resolveWorkflowStateIds(
    ['Done'],
    { teamIds: [TEAM_A, TEAM_C] },
    { getStates: async () => STATES as any }
  );
  expect(ids).toEqual(['done-a']);
});

test('resolveWorkflowStateIds returns undefined when no names match', async () => {
  const ids = await resolveWorkflowStateIds(
    ['Unknown'],
    {},
    {
      getStates: async () => STATES as any,
    }
  );
  expect(ids).toBeUndefined();
});

test('resolveStateId prefers a match within the provided team', async () => {
  const id = await resolveStateId(
    'Done',
    { teamIds: [TEAM_B] },
    {
      getStates: async () => STATES as any,
    }
  );
  expect(id).toBe('done-b');
});
