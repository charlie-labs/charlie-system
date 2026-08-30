import { expect, test } from 'bun:test';

import {
  formatForLinear,
  formatForLinearString,
} from '../format-for-linear.js';

test('formatForLinear formats Slack-style links for Linear', async () => {
  const input =
    'See <https://linear.app/charlie-labs/issue/BOT-123|BOT-123> for details.';

  const out = await formatForLinearString(input);

  expect(out).toBe(
    'See [BOT-123](https://linear.app/charlie-labs/issue/BOT-123) for details.\n'
  );
});

test('formatForLinear is idempotent', async () => {
  const input =
    'See <https://linear.app/charlie-labs/issue/BOT-123|BOT-123> for details.';

  const once = await formatForLinearString(input);
  const twice = await formatForLinearString(once);

  expect(twice).toBe(once);
});

test('formatForLinear passes through nullish/empty values', async () => {
  expect(await formatForLinear(undefined)).toBeUndefined();
  expect(await formatForLinear(null)).toBeNull();
  expect(await formatForLinear('')).toBe('');
});
