type JsonCapable = Readonly<{
  readonly jsonEnabled?: () => boolean;
}>;

export function outputResult<T>(command: JsonCapable, result: T): T {
  if (command.jsonEnabled?.()) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
  return result;
}
