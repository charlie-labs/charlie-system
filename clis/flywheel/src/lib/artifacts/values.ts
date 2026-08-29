export function asRecord(
  value: unknown
): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringField(
  value: Readonly<Record<string, unknown>>,
  field: string
): string | undefined {
  const candidate = value[field];
  return typeof candidate === 'string' && candidate.trim() !== ''
    ? candidate.trim()
    : undefined;
}

export function stringListField(
  value: Readonly<Record<string, unknown>>,
  field: string
): readonly string[] | undefined {
  const candidate = value[field];
  if (typeof candidate === 'string') {
    return candidate.trim() === '' ? [] : [candidate.trim()];
  }
  if (!Array.isArray(candidate)) {
    return undefined;
  }
  const strings = candidate.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
  );
  return strings.length === candidate.length
    ? strings.map((entry) => entry.trim())
    : undefined;
}

export function stringRecordField(
  value: Readonly<Record<string, unknown>>,
  field: string
): Readonly<Record<string, string>> | undefined {
  const candidate = asRecord(value[field]);
  if (candidate === undefined) {
    return undefined;
  }
  const entries = Object.entries(candidate);
  if (entries.some(([, entry]) => typeof entry !== 'string')) {
    return undefined;
  }
  return Object.fromEntries(
    entries.flatMap(([key, entry]) =>
      typeof entry === 'string' ? [[key, entry]] : []
    )
  );
}
