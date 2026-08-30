import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type GetProjectQuery,
  type GetProjectQueryVariables,
  type GetProjectsQuery,
  ProjectStatusType,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import { NotFoundError } from '../../../../lib/errors/not-found-error.js';
import ProjectView from '../view.js';

function makeSdkStub(): Pick<Sdk, 'GetProjects' | 'GetProject'> {
  return {
    async GetProjects(): Promise<GetProjectsQuery> {
      return {
        projects: {
          nodes: [
            {
              id: 'PRJ_123',
              name: 'Roadmap Overhaul',
              description: '',
              createdAt: new Date('2024-01-01T00:00:00Z').toISOString() as any,
              updatedAt: new Date('2024-01-02T00:00:00Z').toISOString() as any,
              slugId: 'RDMP',
              teams: { nodes: [{ id: 'TEAM_1', key: 'FE', name: 'Frontend' }] },
              status: {
                id: 'STAT_1',
                name: 'In Progress',
                position: 1,
                type: ProjectStatusType.Started,
              },
              priority: 1,
              completedAt: null as any,
              initiatives: {
                nodes: [
                  { id: 'INIT_1', name: 'Launch Platform', slugId: 'LAUNCH' },
                ],
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async GetProject({
      id,
    }: GetProjectQueryVariables): Promise<GetProjectQuery> {
      return {
        project:
          id === 'PRJ_123'
            ? {
                id: 'PRJ_123',
                name: 'Roadmap Overhaul',
                url: 'https://linear.example.com/project/roadmap-overhaul',
                description: 'Top-level project to rework the roadmap UI.',
                slugId: 'RDMP',
                createdAt: new Date(
                  '2024-01-01T00:00:00Z'
                ).toISOString() as any,
                updatedAt: new Date(
                  '2024-01-02T00:00:00Z'
                ).toISOString() as any,
                color: '#ff0000',
                content: null,
                status: {
                  id: 'STAT_1',
                  name: 'In Progress',
                  position: 1,
                  type: ProjectStatusType.Started,
                },
                priority: 1,
                labels: { nodes: [] },
                teams: {
                  nodes: [
                    { id: 'TEAM_1', key: 'FE', name: 'Frontend' },
                    { id: 'TEAM_2', key: 'DES', name: 'Design' },
                  ],
                },
                initiatives: { nodes: [] },
                lead: {
                  id: 'USR_1',
                  name: 'Alice Example',
                  displayName: 'Alice',
                },
                issues: { nodes: [] },
                needs: { nodes: [] },
                documents: {
                  nodes: [
                    {
                      id: 'DOC_1',
                      title: 'Product Brief',
                      url: 'https://docs.example.com/product-brief',
                    },
                  ],
                },
                externalLinks: {
                  nodes: [
                    {
                      id: 'LINK_1',
                      label: 'Figma File',
                      url: 'https://figma.com/file/ABC123',
                    },
                  ],
                },
              }
            : {
                id: 'PRJ_UNKNOWN',
                name: 'Unknown',
                url: 'https://linear.example.com/project/unknown',
                description: '',
                createdAt: new Date(
                  '2024-01-01T00:00:00Z'
                ).toISOString() as any,
                updatedAt: new Date(
                  '2024-01-02T00:00:00Z'
                ).toISOString() as any,
                slugId: 'UNK',
                color: '#000000',
                content: null,
                status: {
                  id: 'STAT_1',
                  name: 'In Progress',
                  position: 1,
                  type: ProjectStatusType.Started,
                },
                priority: 0,
                labels: { nodes: [] },
                teams: { nodes: [] },
                initiatives: { nodes: [] },
                lead: {
                  id: 'USR_1',
                  name: 'Alice Example',
                  displayName: 'Alice',
                },
                issues: { nodes: [] },
                needs: { nodes: [] },
                documents: { nodes: [] },
                externalLinks: { nodes: [] },
              },
      };
    },
  };
}

test('project view returns project object in JSON mode', async () => {
  const client = makeSdkStub();

  const config = await Config.load();
  const cmd: any = new ProjectView(['Roadmap Overhaul', '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  const result = (await cmd.run()) as NonNullable<GetProjectQuery['project']>;

  expect(result?.id).toBe('PRJ_123');
  expect(result?.url).toBe(
    'https://linear.example.com/project/roadmap-overhaul'
  );
  expect(result?.teams?.nodes?.length).toBe(2);
  expect(result?.status?.name).toBe('In Progress');
  expect(result?.documents?.nodes?.length).toBe(1);
  expect(result?.externalLinks?.nodes?.length).toBe(1);
});

test('project view prints teams, documents, and external links in text mode', async () => {
  const client = makeSdkStub();

  const config = await Config.load();
  const cmd: any = new ProjectView(['Roadmap Overhaul'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });

  const out: string[] = [];
  const origWrite = process.stdout.write as any;
  // @ts-ignore capture stdout output like other command tests
  process.stdout.write = (chunk: any) => {
    out.push(String(chunk));
    return true;
  };
  // Also intercept BaseCommand.logInfo to reliably capture human output
  const origLogInfo = (cmd as any).logInfo?.bind(cmd);
  (cmd as any).logInfo = (msg?: string) => {
    if (msg !== undefined) out.push(String(msg) + '\n');
  };
  try {
    await cmd.run();
  } finally {
    // Restore stdout
    // @ts-ignore bun/node compatible signature
    process.stdout.write = origWrite;
    if (origLogInfo) (cmd as any).logInfo = origLogInfo;
  }

  const joined = out.join('');
  expect(joined).toMatch(/Teams\s+?:\s+Frontend, Design/);
  expect(joined).toMatch(/Documents:/);
  expect(joined).toMatch(/Product Brief/);
  expect(joined).toMatch(/External Links:/);
  expect(joined).toMatch(/Figma File/);
  expect(joined).toMatch(/Status\s+?:\s+In Progress/);
});

test('project view exits with code 1 when resolver cannot find a project', async () => {
  const client: Pick<Sdk, 'GetProjects' | 'GetProject'> = {
    async GetProjects(): Promise<GetProjectsQuery> {
      return {
        projects: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async GetProject(): Promise<GetProjectQuery> {
      // Not called in this scenario; return a valid shape to satisfy typing
      return {
        project: {
          id: 'PRJ_IGNORED',
          name: 'Ignored',
          url: 'https://linear.example.com/project/ignored',
          description: '',
          createdAt: new Date('2024-01-01T00:00:00Z').toISOString() as any,
          updatedAt: new Date('2024-01-02T00:00:00Z').toISOString() as any,
          slugId: 'IGN',
          color: '#000000',
          content: null,
          priority: 0,
          labels: { nodes: [] },
          status: {
            id: 'STAT_1',
            name: 'In Progress',
            position: 1,
            type: ProjectStatusType.Started,
          },
          teams: { nodes: [] },
          initiatives: { nodes: [] },
          lead: { id: 'USR_1', name: 'Alice Example', displayName: 'Alice' },
          issues: { nodes: [] },
          needs: { nodes: [] },
          documents: { nodes: [] },
          externalLinks: { nodes: [] },
        },
      };
    },
  };

  const config = await Config.load();
  const cmd: any = new ProjectView(['Unknown Project', '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });

  try {
    await cmd.run();
    throw new Error('expected ResolutionError → exit 1');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(1);
    expect((err as Error).message).toBe('Project not found.');
  }
});

test('project view exits with code 1 and NotFound-style message when API returns null', async () => {
  const client: Pick<Sdk, 'GetProjects' | 'GetProject'> = {
    async GetProjects(): Promise<GetProjectsQuery> {
      return {
        projects: {
          nodes: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'Roadmap Overhaul',
              description: '',
              createdAt: new Date('2024-01-01T00:00:00Z').toISOString() as any,
              updatedAt: new Date('2024-01-02T00:00:00Z').toISOString() as any,
              slugId: 'RDMP',
              teams: { nodes: [] },
              status: {
                id: 'STAT_1',
                name: 'In Progress',
                position: 1,
                type: ProjectStatusType.Started,
              },
              priority: 1,
              completedAt: null as any,
              initiatives: { nodes: [] },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async GetProject(): Promise<GetProjectQuery> {
      // Simulate a NotFound condition
      throw new NotFoundError(
        'project',
        '00000000-0000-4000-8000-000000000001'
      );
    },
  };

  const config = await Config.load();
  const cmd: any = new ProjectView(['Roadmap Overhaul', '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  try {
    await cmd.run();
    throw new Error('expected NotFoundError → exit 1');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(1);
    expect((err as Error).message).toBe('Project not found.');
  }
});

test('project view exits with code 1 on ApiRequestError-like transport failure', async () => {
  const client: Pick<Sdk, 'GetProjects' | 'GetProject'> = {
    async GetProjects(): Promise<GetProjectsQuery> {
      return {
        projects: {
          nodes: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'Roadmap Overhaul',
              description: '',
              createdAt: new Date('2024-01-01T00:00:00Z').toISOString() as any,
              updatedAt: new Date('2024-01-02T00:00:00Z').toISOString() as any,
              slugId: 'RDMP',
              teams: { nodes: [] },
              status: {
                id: 'STAT_1',
                name: 'In Progress',
                position: 1,
                type: ProjectStatusType.Started,
              },
              priority: 1,
              completedAt: null as any,
              initiatives: { nodes: [] },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async GetProject(): Promise<GetProjectQuery> {
      // Simulate transport/other request failure handled by ApiRequestError
      throw new Error('boom');
    },
  };

  const config = await Config.load();
  const cmd: any = new ProjectView(['Roadmap Overhaul', '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  try {
    await cmd.run();
    throw new Error('expected ApiRequestError → exit 1');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(1);
    expect((err as Error).message).toBe('Failed to fetch project');
  }
});
