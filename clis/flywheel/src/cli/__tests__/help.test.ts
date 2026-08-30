import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  helpEntries,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves root, topic, and exact leaf command help', async () => {
  const [root, content, setup, knowledge, skill, preset] = await Promise.all([
    runCli(['--help']),
    runCli(['content', '--help']),
    runCli(['content', 'setup', '--help']),
    runCli(['knowledge', '--help']),
    runCli(['skill', '--help']),
    runCli(['skill', 'preset', '--help']),
  ]);

  for (const result of [root, content, setup, knowledge, skill, preset]) {
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  }

  expect(root.stdout).toContain('$ flywheel [COMMAND]');
  expect(helpEntries(root.stdout, 'TOPICS')).toEqual([
    'content',
    'knowledge',
    'skill',
  ]);
  expect(helpEntries(content.stdout, 'TOPICS')).toEqual(['content setup']);
  expect(helpEntries(content.stdout, 'COMMANDS')).toEqual([
    'content related',
    'content rg',
    'content show',
    'content validate',
  ]);
  expect(helpEntries(setup.stdout, 'COMMANDS')).toEqual([
    'content setup customer',
    'content setup source-repo',
  ]);
  expect(helpEntries(knowledge.stdout, 'COMMANDS')).toEqual([
    'knowledge search',
  ]);
  expect(helpEntries(skill.stdout, 'TOPICS')).toEqual(['skill preset']);
  expect(helpEntries(preset.stdout, 'COMMANDS')).toEqual([
    'skill preset list',
    'skill preset show',
  ]);
  expect([
    ...helpEntries(content.stdout, 'COMMANDS'),
    ...helpEntries(knowledge.stdout, 'COMMANDS'),
    ...helpEntries(preset.stdout, 'COMMANDS'),
  ]).toEqual([
    'content related',
    'content rg',
    'content show',
    'content validate',
    'knowledge search',
    'skill preset list',
    'skill preset show',
  ]);
});

test('keeps setup help focused while retaining JSON output support', async () => {
  const [customer, sourceRepo] = await Promise.all([
    runCli(['content', 'setup', 'customer', '--help']),
    runCli(['content', 'setup', 'source-repo', '--help']),
  ]);

  for (const result of [customer, sourceRepo]) {
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.split('EXAMPLES\n')[1]).not.toContain('--json');
  }
});
