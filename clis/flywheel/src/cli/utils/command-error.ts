import type { CommandError } from '@oclif/core/interfaces';

export function isOclifParserError(error: CommandError): boolean {
  const message = error.message.trim();
  return (
    error.name === 'ZodError' ||
    error.message.includes('See more help with --help') ||
    message.startsWith('Flag ') ||
    message.startsWith('Nonexistent flag') ||
    message.startsWith('Unexpected argument') ||
    message.startsWith('Missing ') ||
    message.startsWith('[\n')
  );
}

export function oclifExit(error: CommandError): number | undefined {
  const candidate: unknown = error;
  if (!isRecord(candidate)) return undefined;
  const oclif = candidate['oclif'];
  if (!isRecord(oclif)) return undefined;
  const exit = oclif['exit'];
  return typeof exit === 'number' ? exit : undefined;
}

export function summarizeOclifParserError(error: CommandError): string {
  if (error.name === 'ZodError') return 'invalid command options';
  return (
    error.message.split('\nSee more help with --help', 1)[0] ?? error.message
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
