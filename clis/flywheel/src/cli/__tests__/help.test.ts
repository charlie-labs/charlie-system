import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  helpEntries,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves root, topic, and exact leaf command help', async () => {
  const [root, content, skill, preset] = await Promise.all([
    runCli(['--help']),
    runCli(['content', '--help']),
    runCli(['skill', '--help']),
    runCli(['skill', 'preset', '--help']),
  ]);

  for (const result of [root, content, skill, preset]) {
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  }

  expect(root.stdout).toContain('$ flywheel [COMMAND]');
  expect(helpEntries(root.stdout, 'TOPICS')).toEqual(['content', 'skill']);
  expect(helpEntries(content.stdout, 'COMMANDS')).toEqual([
    'content related',
    'content rg',
    'content show',
    'content validate',
  ]);
  expect(helpEntries(skill.stdout, 'TOPICS')).toEqual(['skill preset']);
  expect(helpEntries(preset.stdout, 'COMMANDS')).toEqual([
    'skill preset list',
    'skill preset show',
  ]);
  expect([
    ...helpEntries(content.stdout, 'COMMANDS'),
    ...helpEntries(preset.stdout, 'COMMANDS'),
  ]).toEqual([
    'content related',
    'content rg',
    'content show',
    'content validate',
    'skill preset list',
    'skill preset show',
  ]);
});
