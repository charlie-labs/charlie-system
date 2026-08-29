import { expect, test } from 'bun:test';

import { MemoryCacheProvider } from '../../../cache/memory-cache-provider.js';
import { listProjects } from '../list-projects.js';

test('listProjects fetches one page and caches', async () => {
  let calls = 0;
  const client = {
    async GetProjects() {
      calls += 1;
      return {
        projects: {
          nodes: [
            {
              id: 'p2',
              name: 'Two',
              description: '',
              createdAt: '',
              updatedAt: '',
              slugId: '',
              teams: { nodes: [] },
              status: {
                id: 's',
                name: 'Started',
                position: 1,
                type: 'started',
              },
              initiatives: { nodes: [] },
            },
            {
              id: 'p1',
              name: 'One',
              description: '',
              createdAt: '',
              updatedAt: '',
              slugId: '',
              teams: { nodes: [] },
              status: {
                id: 's',
                name: 'Started',
                position: 1,
                type: 'started',
              },
              initiatives: { nodes: [] },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'CUR1' },
        },
      } as any;
    },
  };
  const cache = new MemoryCacheProvider();
  const projects = await listProjects({}, { client, cache });
  expect(projects.map((p: any) => p.id).sort()).toEqual(['p1', 'p2']);
  await listProjects({}, { client, cache });
  expect(calls).toBe(1); // second invocation should use cache (no extra underlying calls)
});

test('listProjects respects limit (uses `first = limit` on single request)', async () => {
  let calls = 0;
  const pageNodes = Array.from({ length: 30 }).map((_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    description: '',
    createdAt: '',
    updatedAt: '',
    slugId: '',
    teams: { nodes: [] },
    status: { id: 's', name: 'Started', position: 1, type: 'started' },
    initiatives: { nodes: [] },
  }));
  const client = {
    async GetProjects(vars: any) {
      calls += 1;
      // Return a single page with 30 nodes regardless of `first`
      return {
        projects: {
          nodes: pageNodes.slice(0, vars.first ?? 30),
          pageInfo: { hasNextPage: true, endCursor: 'CURX' },
        },
      } as any;
    },
  };
  const out = await listProjects({ limit: 20 }, { client });
  expect(out.length).toBe(20);
  expect(out.map((p: any) => p.id).slice(0, 3)).toEqual(['p1', 'p2', 'p3']);
  expect(calls).toBe(1);
});
