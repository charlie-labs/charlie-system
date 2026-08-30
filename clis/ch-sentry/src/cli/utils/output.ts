type JsonCapable = Readonly<{
  readonly jsonEnabled?: () => boolean;
}>;

export function outputResult<T>(command: JsonCapable, result: T): T {
  void command;
  return result;
}
