import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  helpEntries,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

type CliResult = Awaited<ReturnType<typeof runCli>>;

test('proves root, topic, and exact leaf command help', async () => {
  const [root, content, setup, knowledge, skill, preset, validate] =
    await runHelpCommands();

  expectSuccessfulHelp([
    root,
    content,
    setup,
    knowledge,
    skill,
    preset,
    validate,
  ]);
  expectRootHelp(root);
  expectContentHelp(content, setup);
  expectKnowledgeAndSkillHelp(content, knowledge, skill, preset);
  expect(validate.stdout).toContain(
    '--repository-path=<value>  Flywheel repository path'
  );
  expect(validate.stdout).toContain('/home/user/.charlie/flywheel');
  expect(validate.stdout).not.toContain(['customer', 'knowledge'].join('-'));
  expect(validate.stdout).not.toContain(['knowledge', 'repository'].join(' '));
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

async function runHelpCommands() {
  return Promise.all([
    runCli(['--help']),
    runCli(['content', '--help']),
    runCli(['content', 'setup', '--help']),
    runCli(['knowledge', '--help']),
    runCli(['skill', '--help']),
    runCli(['skill', 'preset', '--help']),
    runCli(['content', 'validate', '--help']),
  ]);
}

function expectSuccessfulHelp(results: readonly CliResult[]) {
  for (const result of results) {
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  }
}

function expectRootHelp(root: CliResult) {
  expect(root.stdout).toContain('$ flywheel [COMMAND]');
  expect(helpEntries(root.stdout, 'TOPICS')).toEqual([
    'content',
    'knowledge',
    'skill',
  ]);
}

function expectContentHelp(content: CliResult, setup: CliResult) {
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
}

function expectKnowledgeAndSkillHelp(
  content: CliResult,
  knowledge: CliResult,
  skill: CliResult,
  preset: CliResult
) {
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
}
