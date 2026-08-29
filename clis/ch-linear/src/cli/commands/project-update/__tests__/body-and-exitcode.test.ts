import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';
import { PassThrough } from 'node:stream';

import ProjectUpdateCreate from '../create.js';
import ProjectUpdateEdit from '../edit.js';

const slackLinkInput =
  'See <https://linear.app/charlie-labs/issue/BOT-123|BOT-123> for details.';
const linearLinkOutput =
  'See [BOT-123](https://linear.app/charlie-labs/issue/BOT-123) for details.\n';

async function withMockedStdin<T>(
  content: string,
  fn: () => Promise<T>
): Promise<T> {
  const origDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
  if (!origDescriptor) {
    throw new Error('process.stdin descriptor not found');
  }

  const mock = new PassThrough();
  // Ensure readAllStdin() treats this as non-interactive
  Object.defineProperty(mock, 'isTTY', { value: false });
  mock.end(content);

  Object.defineProperty(process, 'stdin', {
    value: mock,
    configurable: true,
  });

  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'stdin', origDescriptor);
  }
}

test('project-update edit exits with code 2 for a mapped validation error (mapError exitCode preserved)', async () => {
  const client = {
    async ProjectUpdateUpdate() {
      throw new Error('unexpected network call');
    },
  } as any;

  const config = await Config.load();
  ProjectUpdateEdit.setTestDeps({ client });
  const cmd = new ProjectUpdateEdit(['upd_123', '--json'], config);

  try {
    await cmd.run();
    throw new Error('expected ValidationError → exit 2');
  } catch (err) {
    expect((err as any)?.oclif?.exit).toBe(2);
    expect((err as Error).message).toBe(
      'No update flags provided. Nothing to do.'
    );
  }
});

test('project-update create formats --body flag via formatForLinearString()', async () => {
  let capturedInput: any;
  const client = {
    async GetProjects() {
      return {
        projects: {
          nodes: [{ id: 'PRJ_123', name: 'Website Refresh' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async ProjectUpdateCreate(vars: any) {
      capturedInput = vars.input;
      return {
        projectUpdateCreate: {
          success: true,
          projectUpdate: {
            id: 'UPD_123',
            project: { name: 'Website Refresh' },
            health: 'onTrack',
            user: null,
            createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            url: 'https://linear.example.com/project-update/UPD_123',
          },
        },
      };
    },
  } as any;

  const config = await Config.load();
  ProjectUpdateCreate.setTestDeps({ client });
  const cmd = new ProjectUpdateCreate(
    ['--project', 'Website Refresh', '--body', slackLinkInput, '--json'],
    config
  );

  await cmd.run();

  expect(capturedInput?.body).toBe(linearLinkOutput);
});

test('project-update create formats stdin body (`--body -`) via formatForLinearString()', async () => {
  let capturedInput: any;
  const client = {
    async GetProjects() {
      return {
        projects: {
          nodes: [{ id: 'PRJ_123', name: 'Website Refresh' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    },
    async ProjectUpdateCreate(vars: any) {
      capturedInput = vars.input;
      return {
        projectUpdateCreate: {
          success: true,
          projectUpdate: {
            id: 'UPD_123',
            project: { name: 'Website Refresh' },
            health: 'onTrack',
            user: null,
            createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            url: 'https://linear.example.com/project-update/UPD_123',
          },
        },
      };
    },
  } as any;

  const config = await Config.load();
  ProjectUpdateCreate.setTestDeps({ client });

  await withMockedStdin(slackLinkInput, async () => {
    const cmd = new ProjectUpdateCreate(
      ['--project', 'Website Refresh', '--body', '-', '--json'],
      config
    );
    await cmd.run();
  });

  expect(capturedInput?.body).toBe(linearLinkOutput);
});

test('project-update edit formats --body flag via formatForLinearString()', async () => {
  let capturedInput: any;
  const client = {
    async ProjectUpdateUpdate(vars: any) {
      capturedInput = vars.input;
      return {
        projectUpdateUpdate: {
          success: true,
          projectUpdate: {
            id: vars.id,
            project: { name: 'Website Refresh' },
            health: 'onTrack',
            user: null,
            createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            url: 'https://linear.example.com/project-update/UPD_123',
          },
        },
      };
    },
  } as any;

  const config = await Config.load();
  ProjectUpdateEdit.setTestDeps({ client });
  const cmd = new ProjectUpdateEdit(
    ['UPD_123', '--body', slackLinkInput, '--json'],
    config
  );

  await cmd.run();

  expect(capturedInput?.body).toBe(linearLinkOutput);
});

test('project-update edit formats stdin body (`--body -`) via formatForLinearString()', async () => {
  let capturedInput: any;
  const client = {
    async ProjectUpdateUpdate(vars: any) {
      capturedInput = vars.input;
      return {
        projectUpdateUpdate: {
          success: true,
          projectUpdate: {
            id: vars.id,
            project: { name: 'Website Refresh' },
            health: 'onTrack',
            user: null,
            createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            url: 'https://linear.example.com/project-update/UPD_123',
          },
        },
      };
    },
  } as any;

  const config = await Config.load();
  ProjectUpdateEdit.setTestDeps({ client });

  await withMockedStdin(slackLinkInput, async () => {
    const cmd = new ProjectUpdateEdit(
      ['UPD_123', '--body', '-', '--json'],
      config
    );
    await cmd.run();
  });

  expect(capturedInput?.body).toBe(linearLinkOutput);
});
