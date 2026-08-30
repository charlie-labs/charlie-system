import { BaseCommand } from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Config } from '@oclif/core';
import { expect, test } from 'bun:test';

class InfoSuppressionCommand extends BaseCommand {
  protected async execute(): Promise<unknown> {
    this.logInfo(
      'Retrying request (attempt 2/3) after 429 Too Many Requests (retry-after: 1.2s)'
    );
    return undefined; // no JSON body
  }
}

class RowsSuppressionCommand extends BaseCommand {
  protected async execute(): Promise<unknown> {
    this.printRows([['ENG-1', 'Example issue', 'Todo', 'Alice']], {
      header: ['identifier', 'title', 'state', 'assignee'],
    });
    return undefined;
  }
}

test('logInfo suppressed in JSON mode', async () => {
  const config = await Config.load();
  const cmd = new InfoSuppressionCommand(['--json'], config);

  const out: string[] = [];
  const origWrite = process.stdout.write;
  // Override to capture output
  // @ts-ignore - compatible signature
  process.stdout.write = (chunk: any) => {
    out.push(String(chunk));
    return true;
  };
  try {
    await cmd.run();
  } finally {
    // @ts-ignore restore type
    process.stdout.write = origWrite;
  }
  expect(out.filter((l) => l.trim().length > 0).length).toBe(0);
});

test('printRows suppressed in JSON mode', async () => {
  const config = await Config.load();
  const cmd = new RowsSuppressionCommand(['--json'], config);
  const out: string[] = [];
  const origWrite = process.stdout.write;
  // @ts-ignore capture
  process.stdout.write = (chunk: any) => {
    out.push(String(chunk));
    return true;
  };
  try {
    await cmd.run();
  } finally {
    // @ts-ignore restore
    process.stdout.write = origWrite;
  }
  expect(out.filter((l) => l.trim().length > 0).length).toBe(0);
});
