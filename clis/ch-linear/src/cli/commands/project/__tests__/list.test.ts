import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

import {
  type GetProjectsQuery,
  type GetProjectsQueryVariables,
  type Sdk,
} from '../../../../generated/linear-sdk.js';
import ProjectList from '../list.js';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

function makeProjectsStub(): GetProjectsQuery {
  return {
    projects: {
      nodes: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    },
  };
}

test('passes teamId variable when --team flag provided', async () => {
  const captured: GetProjectsQueryVariables[] = [];

  const client: Pick<Sdk, 'GetProjects'> = {
    async GetProjects(
      vars: GetProjectsQueryVariables
    ): Promise<GetProjectsQuery> {
      captured.push(vars);
      return makeProjectsStub();
    },
  };

  const teamId = uuid(1);
  const config = await Config.load();
  const cmd: any = new ProjectList(['--team', teamId, '--json'], config);
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toEqual(
    expect.objectContaining({
      teamId,
    })
  );
});

test('passes statusType variable when --status-type flag provided', async () => {
  const captured: GetProjectsQueryVariables[] = [];

  const client: Pick<Sdk, 'GetProjects'> = {
    async GetProjects(
      vars: GetProjectsQueryVariables
    ): Promise<GetProjectsQuery> {
      captured.push(vars);
      return makeProjectsStub();
    },
  };

  const statusType = 'archived';
  const config = await Config.load();
  const cmd: any = new ProjectList(
    ['--status-type', statusType, '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toEqual(
    expect.objectContaining({
      statusType,
    })
  );
});

test('passes initiativeId variable when --initiative flag provided', async () => {
  const captured: GetProjectsQueryVariables[] = [];

  const client: Pick<Sdk, 'GetProjects'> = {
    async GetProjects(
      vars: GetProjectsQueryVariables
    ): Promise<GetProjectsQuery> {
      captured.push(vars);
      return makeProjectsStub();
    },
  };

  const initiativeId = uuid(2);
  const config = await Config.load();
  const cmd: any = new ProjectList(
    ['--initiative', initiativeId, '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toEqual(
    expect.objectContaining({
      initiativeId,
    })
  );
});

test('combines multiple filter variables when multiple flags provided', async () => {
  const captured: GetProjectsQueryVariables[] = [];

  const client: Pick<Sdk, 'GetProjects'> = {
    async GetProjects(
      vars: GetProjectsQueryVariables
    ): Promise<GetProjectsQuery> {
      captured.push(vars);
      return makeProjectsStub();
    },
  };

  const teamId = uuid(3);
  const initiativeId = uuid(4);
  const statusType = 'started';

  const config = await Config.load();
  const cmd: any = new ProjectList(
    [
      '--team',
      teamId,
      '--initiative',
      initiativeId,
      '--status-type',
      statusType,
      '--json',
    ],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toEqual(
    expect.objectContaining({
      teamId,
      initiativeId,
      statusType,
    })
  );
});

test('normalises mixed-case and padded flag values to lowercase', async () => {
  const captured: GetProjectsQueryVariables[] = [];

  const client: Pick<Sdk, 'GetProjects'> = {
    async GetProjects(
      vars: GetProjectsQueryVariables
    ): Promise<GetProjectsQuery> {
      captured.push(vars);
      return makeProjectsStub();
    },
  };

  const statusTypeRaw = '  STARTED  ';
  const config = await Config.load();
  const cmd: any = new ProjectList(
    ['--status-type', statusTypeRaw, '--json'],
    config
  );
  Object.defineProperty(cmd, 'deps', {
    value: { client },
    configurable: true,
    enumerable: false,
    writable: true,
  });
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toEqual(
    expect.objectContaining({
      statusType: 'started',
    })
  );
});
