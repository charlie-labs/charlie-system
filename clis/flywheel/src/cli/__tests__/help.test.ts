import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  helpEntries,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves root, topic, and exact leaf command help', async () => {
  const [root, content, knowledge, skill, preset, validate] = await Promise.all(
    [
      runCli(['--help']),
      runCli(['content', '--help']),
      runCli(['knowledge', '--help']),
      runCli(['skill', '--help']),
      runCli(['skill', 'preset', '--help']),
      runCli(['content', 'validate', '--help']),
    ]
  );

  for (const result of [root, content, knowledge, skill, preset, validate]) {
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  }

  expect(root.stdout).toContain('$ flywheel [COMMAND]');
  expect(helpEntries(root.stdout, 'TOPICS')).toEqual([
    'content',
    'knowledge',
    'skill',
  ]);
  expect(helpEntries(content.stdout, 'COMMANDS')).toEqual([
    'content related',
    'content rg',
    'content show',
    'content validate',
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
  expect(validate.stdout).toContain(
    '--repository-path=<value>  Flywheel repository path'
  );
  expect(validate.stdout).toContain('/home/user/.charlie/flywheel');
  expect(validate.stdout).not.toContain(['customer', 'knowledge'].join('-'));
  expect(validate.stdout).not.toContain(['knowledge', 'repository'].join(' '));
});
