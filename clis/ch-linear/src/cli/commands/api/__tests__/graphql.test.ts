import { Config } from '@oclif/core';
import { afterEach, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ApiGraphql from '../graphql.js';

afterEach(() => {
  // ensure isolation between tests
  delete (globalThis as any).__CH_LINEAR_TEST_RAW_GQL__;
});

function makeStub(responses: any[]) {
  let callCount = 0;
  const fn: any = async () => {
    const resp = responses[Math.min(callCount, responses.length - 1)];
    callCount += 1;
    return resp;
  };
  fn.getCalls = () => callCount;
  return fn;
}

test('parses --var values with smart typing', async () => {
  const captured: any[] = [];
  (globalThis as any).__CH_LINEAR_TEST_RAW_GQL__ = async (
    _q: string,
    vars: any
  ) => {
    captured.push(vars);
    return {};
  };

  const config = await Config.load();
  const cmd = new ApiGraphql(
    [
      '-q',
      '{ viewer { id } }',
      '-v',
      'str=hello',
      '-v',
      'num=42',
      '-v',
      'bool=true',
      '-v',
      'nil=null',
      '--json',
    ],
    config
  );
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toEqual({
    str: 'hello',
    num: 42,
    bool: true,
    nil: null,
  });
});

test('loads query from @file path', async () => {
  const tmpFile = join(tmpdir(), `query-${Date.now()}.graphql`);
  const queryContent = '{ issue(id: "abc") { id } }';
  await fs.writeFile(tmpFile, queryContent, 'utf8');

  const captured: any[] = [];
  (globalThis as any).__CH_LINEAR_TEST_RAW_GQL__ = async (
    q: string,
    _vars: any
  ) => {
    captured.push(q);
    return {};
  };

  const config = await Config.load();
  const cmd = new ApiGraphql(['-q', `@${tmpFile}`, '--json'], config);
  await cmd.run();

  expect(captured.length).toBe(1);
  expect(captured[0]).toBe(queryContent);
});

test('paginates when --paginate is provided', async () => {
  const stub: any = makeStub([
    { issues: { pageInfo: { hasNextPage: true, endCursor: 'C1' } } },
    { issues: { pageInfo: { hasNextPage: false, endCursor: null } } },
  ]);
  (globalThis as any).__CH_LINEAR_TEST_RAW_GQL__ = stub;

  const config = await Config.load();
  const cmd = new ApiGraphql(
    [
      '-q',
      '{ issues { pageInfo { hasNextPage endCursor } } }',
      '--paginate',
      '--json',
    ],
    config
  );
  const result: any = await cmd.run();

  expect(stub.getCalls()).toBe(2);
  expect(Array.isArray(result)).toBe(true);
  expect(result.length).toBe(2);
});
