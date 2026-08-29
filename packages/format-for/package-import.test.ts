import { expect, test } from 'bun:test';

import { formatFor } from '@charlie-labs/format-for';

test('package export formats GitHub, Linear, and Slack content', async () => {
  const markdown = '**hello**';
  const [github, linear, slack] = await Promise.all([
    formatFor.github(markdown),
    formatFor.linear(markdown),
    formatFor.slack(markdown),
  ]);

  expect(github).toContain('**hello**');
  expect(linear).toContain('**hello**');
  expect(slack).toContain('*hello*');
});
