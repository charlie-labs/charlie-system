type PresetErrorMetadata = Readonly<{
  readonly code: string;
  readonly formatMessage: (message: string) => string;
  readonly name: string;
}>;

class PresetError extends Error {
  static readonly exitCode = 2;

  readonly code: string;
  readonly exitCode = 2;
  readonly oclif = { exit: 2 } as const;

  constructor(
    message: string,
    options?: ErrorOptions,
    metadata?: PresetErrorMetadata
  ) {
    super(message, options);
    this.code = metadata?.code ?? '';
    this.name = metadata?.name ?? 'PresetError';
  }
}

function createPresetErrorConstructor(
  metadata: PresetErrorMetadata
): typeof PresetError {
  const instances = new WeakSet<PresetError>();
  return new Proxy(PresetError, {
    get(target, property, receiver) {
      if (property === 'name') {
        return metadata.name;
      }
      if (property === Symbol.hasInstance) {
        return (value: unknown) =>
          value instanceof PresetError && instances.has(value);
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return value;
    },
    construct(_target, args: readonly unknown[]) {
      const message = args[0];
      if (typeof message !== 'string') {
        throw new TypeError('preset error message must be a string');
      }
      const options = args[1];
      const error = new PresetError(
        metadata.formatMessage(message),
        isErrorOptions(options) ? options : undefined,
        metadata
      );
      instances.add(error);
      return error;
    },
  });
}

function isErrorOptions(value: unknown): value is ErrorOptions {
  return value === undefined || (typeof value === 'object' && value !== null);
}

export const PresetInvocationError = createPresetErrorConstructor({
  code: 'ESKILL_PRESET_INVOCATION',
  formatMessage: (message) => message,
  name: 'PresetInvocationError',
});

export const PresetNotFoundError = createPresetErrorConstructor({
  code: 'ESKILL_PRESET_NOT_FOUND',
  formatMessage: (preset) => `skill preset does not exist: ${preset}`,
  name: 'PresetNotFoundError',
});

export const PresetOperationalError = createPresetErrorConstructor({
  code: 'ESKILL_PRESET_OPERATIONAL',
  formatMessage: (message) => message,
  name: 'PresetOperationalError',
});
