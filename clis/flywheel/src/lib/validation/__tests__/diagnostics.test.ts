import { expect, test } from 'bun:test';

import { sourceLocation } from '../../repository/location.js';
import { validationReport, validationWarning } from '../diagnostics.js';

test('sorts diagnostics by numeric source line and column positions', () => {
  const report = validationReport([
    diagnostic({ column: 11, line: 1, message: 'column eleven' }),
    diagnostic({ column: 1, line: 10, message: 'line ten' }),
    diagnostic({ column: 2, line: 1, message: 'column two' }),
    diagnostic({ column: 1, line: 2, message: 'line two' }),
  ]);

  expect(report.diagnostics.map((item) => item.message)).toEqual([
    'column two',
    'column eleven',
    'line two',
    'line ten',
  ]);
});

function diagnostic(input: {
  readonly column: number;
  readonly line: number;
  readonly message: string;
}) {
  return validationWarning({
    message: input.message,
    path: 'customer-wide/docs/guide.md',
    ruleId: 'FW-TEST-DIAGNOSTIC',
    source: sourceLocation('customer-wide/docs/guide.md', {
      column: input.column,
      line: input.line,
    }),
  });
}
