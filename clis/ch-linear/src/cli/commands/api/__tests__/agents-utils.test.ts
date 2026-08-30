import { expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AGENT_ACTIVITY_TSV_HEADER,
  agentActivityToTsv,
} from '../../../utils/agent-activity.js';
import {
  AGENT_SESSION_TSV_HEADER,
  agentSessionToTsv,
} from '../../../utils/agent-session.js';
import { readJsonOrFile, readTextOrFile } from '../../../utils/flags/file.js';
import { formatIso } from '../../../utils/format.js';
import { isRecord } from '../../../utils/type-guards.js';
import { isValidExternalUrl } from '../../../utils/url.js';

test('readTextOrFile: reads literal values and @file values', async () => {
  expect(await readTextOrFile('hello')).toBe('hello');
  expect(await readTextOrFile('@@hello')).toBe('@hello');
  expect(await readTextOrFile('@@@hello')).toBe('@@hello');
  expect(await readTextOrFile('@@')).toBe('@');

  const pretendFilePath = join(tmpdir(), `ch-linear-pretend-${Date.now()}.txt`);
  expect(await readTextOrFile(`@@${pretendFilePath}`)).toBe(
    `@${pretendFilePath}`
  );

  const filePath = join(tmpdir(), `ch-linear-text-${Date.now()}.txt`);
  await fs.writeFile(filePath, 'from-file', 'utf8');
  expect(await readTextOrFile(`@${filePath}`)).toBe('from-file');
});

test('readTextOrFile: missing file includes raw value and resolved path', async () => {
  const filePath = join(tmpdir(), `ch-linear-missing-${Date.now()}.txt`);
  const raw = `@${filePath}`;
  try {
    await readTextOrFile(raw);
    throw new Error('expected readTextOrFile to throw');
  } catch (err) {
    expect(String(err)).toContain(JSON.stringify(raw));
    expect(String(err)).toContain(JSON.stringify(filePath));
  }
});

test('readJsonOrFile: distinguishes inline vs file JSON errors', async () => {
  expect(await readJsonOrFile('@@{"hello":"world"}')).toEqual({
    hello: 'world',
  });

  const jsonFilePath = join(tmpdir(), `ch-linear-json-${Date.now()}.json`);
  await fs.writeFile(jsonFilePath, JSON.stringify({ hi: 1 }), 'utf8');
  expect(await readJsonOrFile(`@${jsonFilePath}`)).toEqual({ hi: 1 });

  try {
    await readJsonOrFile('@@');
    throw new Error('expected readJsonOrFile to throw');
  } catch (err) {
    expect(String(err)).toContain('empty inline JSON');
  }

  try {
    await readJsonOrFile('@@{');
    throw new Error('expected readJsonOrFile to throw');
  } catch (err) {
    expect(String(err)).toContain('inline value');
  }

  try {
    await readJsonOrFile('@@@{');
    throw new Error('expected readJsonOrFile to throw');
  } catch (err) {
    expect(String(err)).toContain('inline value');
  }

  try {
    await readJsonOrFile('{');
    throw new Error('expected readJsonOrFile to throw');
  } catch (err) {
    expect(String(err)).toContain('inline value');
  }

  const filePath = join(tmpdir(), `ch-linear-invalid-json-${Date.now()}.json`);
  await fs.writeFile(filePath, '{', 'utf8');
  try {
    await readJsonOrFile(`@${filePath}`);
    throw new Error('expected readJsonOrFile to throw');
  } catch (err) {
    expect(String(err)).toContain('from file');
    expect(String(err)).toContain(JSON.stringify(filePath));
  }
});

test('isValidExternalUrl validates only http(s) URLs', () => {
  expect(isValidExternalUrl('https://example.com')).toBe(true);
  expect(isValidExternalUrl('http://example.com')).toBe(true);
  expect(isValidExternalUrl('https://user:pass@example.com')).toBe(false);
  expect(isValidExternalUrl('ftp://example.com')).toBe(false);
  expect(isValidExternalUrl('')).toBe(false);
  expect(isValidExternalUrl('not a url')).toBe(false);
});

test('isRecord narrows to plain objects', () => {
  expect(isRecord({ a: 1 })).toBe(true);
  expect(isRecord(['a'])).toBe(false);
  expect(isRecord(null)).toBe(false);
});

test('formatIso returns ISO strings for valid inputs', () => {
  expect(formatIso('2025-01-02T03:04:05.000Z')).toBe(
    '2025-01-02T03:04:05.000Z'
  );
  expect(formatIso('not-a-date')).toBe('');
  expect(formatIso(undefined)).toBe('');
});

test('agentSessionToTsv is stable and formats timestamps', () => {
  const row = agentSessionToTsv({
    id: 'sess-123',
    status: 'active',
    type: 'issue',
    issue: { identifier: 'ENG-123' },
    comment: { id: 'c-1' },
    createdAt: '2025-01-02T03:04:05.000Z',
    updatedAt: '2025-01-02T03:05:06.000Z',
  });

  expect(row).toEqual([
    'sess-123',
    'active',
    'issue',
    'ENG-123',
    'c-1',
    '2025-01-02T03:04:05.000Z',
    '2025-01-02T03:05:06.000Z',
  ]);
});

test('agentSession TSV header ordering is stable', () => {
  expect(AGENT_SESSION_TSV_HEADER).toEqual([
    'id',
    'status',
    'type',
    'issueIdentifier',
    'commentId',
    'createdAt',
    'updatedAt',
  ]);
});

test('agentActivityToTsv includes snippet and stable column order', () => {
  const row = agentActivityToTsv({
    id: 'act-123',
    signal: 'auth',
    ephemeral: true,
    createdAt: '2025-01-02T03:04:05.000Z',
    updatedAt: '2025-01-02T03:05:06.000Z',
    content: {
      type: 'thought',
      body: 'Hello\n\nworld  with   spacing',
    },
  });

  expect(row).toEqual([
    'act-123',
    'thought',
    'auth',
    'true',
    '2025-01-02T03:04:05.000Z',
    '2025-01-02T03:05:06.000Z',
    'Hello world with spacing',
  ]);
});

test('agentActivity TSV header ordering is stable', () => {
  expect(AGENT_ACTIVITY_TSV_HEADER).toEqual([
    'id',
    'type',
    'signal',
    'ephemeral',
    'createdAt',
    'updatedAt',
    'snippet',
  ]);
});

test('agentActivityToTsv blanks unknown activity types', () => {
  const row = agentActivityToTsv({
    id: 'act-unknown',
    content: {
      type: 'unknown',
      body: 'Hello',
    },
  });

  expect(row[1]).toBe('');
});

test('agentActivityToTsv blanks unknown content.__typename', () => {
  const row = agentActivityToTsv({
    id: 'act-unknown-typename',
    content: {
      __typename: 'AgentActivityWeirdContent',
      body: 'Hello',
    },
  });

  expect(row[1]).toBe('');
});

test('agentActivityToTsv truncates snippets without splitting surrogate pairs', () => {
  const row = agentActivityToTsv({
    id: 'act-emoji',
    content: {
      type: 'thought',
      body: `${'a'.repeat(59)}🙂${'b'.repeat(10)}`,
    },
  });

  expect(row[row.length - 1]).toBe(`${'a'.repeat(59)}🙂`);
});
